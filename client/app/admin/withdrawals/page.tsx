"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLayout, { adminFetch, formatCurrency, getUserLabel } from "../../../components/admin/AdminLayout";
import Loader from "../../../components/admin/Loader";
import Table from "../../../components/admin/Table";
import AdminPagination from "../../../components/admin/AdminPagination";
import ConfirmModal from "../../../components/admin/ConfirmModal";
import { withdrawalStatusClasses } from "../../../components/admin/adminStatusClasses";
import { pushAdminLog } from "../../../lib/adminActivityLog";
import EmptyState from "../../../components/EmptyState";
import { showSafeToast } from "../../../lib/toast";

const PAGE_SIZE = 10;
const ROW_CAP = 100;

export default function AdminWithdrawalsPage() {
  const [listMode, setListMode] = useState<"queue" | "all">("queue");
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState("");
  const [payTxById, setPayTxById] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<
    null | { kind: "approve" | "reject" | "pay"; row: any }
  >(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [confirmActionLoading, setConfirmActionLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadWithdrawals = async () => {
    try {
      setLoading(true);
      setError("");
      const path = listMode === "queue" ? "/admin/withdrawals/pending" : "/admin/withdrawals";
      const payload = await adminFetch(path);
      setWithdrawals(payload?.data?.withdrawals || payload?.withdrawals || []);
    } catch (err: any) {
      const msg = err?.message || "Failed to load withdrawals";
      setError(msg);
      showSafeToast(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWithdrawals();
  }, [listMode]);

  const safeWithdrawals = useMemo(() => withdrawals.slice(0, ROW_CAP), [withdrawals]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return safeWithdrawals.filter((w) => {
      const st = String(w.status || "").toLowerCase();
      const okStatus = statusFilter === "all" || st === statusFilter;
      const u = w.userId;
      const label = getUserLabel(u).toLowerCase();
      const email = (u?.email || "").toLowerCase();
      const wallet = (w.walletAddress || "").toLowerCase();
      const okSearch = !q || label.includes(q) || email.includes(q) || wallet.includes(q);
      return okStatus && okSearch;
    });
  }, [safeWithdrawals, debouncedSearch, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, listMode, withdrawals.length]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const execConfirmed = async () => {
    if (!confirm || confirmActionLoading) return;
    const { kind, row } = confirm;
    const id = row._id;
    if (!id || processingId) return;

    if (kind === "pay") {
      const txHash = String(payTxById[id] || "").trim();
      if (!txHash) {
        const msg = "Enter a transaction hash before marking paid";
        setError(msg);
        showSafeToast(msg);
        setConfirm(null);
        return;
      }
    }

    try {
      setConfirmActionLoading(true);
      setProcessingId(`${kind}:${id}`);
      setMessage("");
      setError("");

      if (kind === "approve") {
        await adminFetch("/admin/hybrid/withdraw/approve", {
          method: "POST",
          body: JSON.stringify({ withdrawalId: id }),
        });
        setMessage("Withdrawal approved");
        pushAdminLog({ action: "Withdrawal approved", detail: getUserLabel(row.userId) });
      } else if (kind === "reject") {
        await adminFetch("/admin/hybrid/withdraw/reject", {
          method: "POST",
          body: JSON.stringify({ withdrawalId: id }),
        });
        setMessage("Withdrawal rejected and refunded");
        pushAdminLog({ action: "Withdrawal rejected", detail: getUserLabel(row.userId) });
      } else if (kind === "pay") {
        const txHash = String(payTxById[id] || "").trim();
        await adminFetch("/admin/hybrid/withdraw/pay", {
          method: "POST",
          body: JSON.stringify({ withdrawalId: id, txHash }),
        });
        setMessage("Marked as paid");
        setPayTxById((prev) => ({ ...prev, [id]: "" }));
        pushAdminLog({
          action: "Withdrawal marked paid",
          detail: `${getUserLabel(row.userId)} · ${txHash.slice(0, 18)}…`,
        });
      }

      setConfirm(null);
      await loadWithdrawals();
    } catch (err: any) {
      const msg = err?.message || "Action failed";
      setError(msg);
      showSafeToast(msg);
      pushAdminLog({
        level: "error",
        action: `Withdrawal ${kind} failed`,
        detail: msg,
      });
      setConfirm(null);
    } finally {
      setProcessingId("");
      setConfirmActionLoading(false);
    }
  };

  const confirmMessage = () => {
    if (!confirm) return "";
    const who = getUserLabel(confirm.row.userId);
    if (confirm.kind === "approve")
      return `Approve withdrawal for ${who}? Ensure the user completed any required wait period.`;
    if (confirm.kind === "reject")
      return `Reject and refund withdrawal for ${who}? This will release pending funds back per system rules.`;
    const tx = String(payTxById[confirm.row._id] || "").trim();
    return `Mark payout as paid for ${who} with tx hash:\n${tx || "(empty)"}`;
  };

  return (
    <AdminLayout
      title="Withdrawal management"
      subtitle="Queue pending work, or open the full ledger. Approve, reject, and record payouts after manual send."
    >
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setListMode("queue")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              listMode === "queue"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Pending queue
          </button>
          <button
            type="button"
            onClick={() => setListMode("all")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              listMode === "all"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            All withdrawals
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user, email, or wallet"
            className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-purple-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#0b0b0f] px-4 py-3 text-sm text-white outline-none sm:w-44"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="claimable">Claimable</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
            <option value="claimed">Claimed</option>
          </select>
        </div>
      </div>

      <StatusMessage message={message} />
      <StatusMessage type="error" message={error} />

      {loading ? (
        <Loader label="Loading withdrawals…" />
      ) : !error && !withdrawals.length ? (
        <EmptyState text="No records found" />
      ) : (
        <Table
          columns={["User", "Gross", "Net", "Wallet", "Status", "Actions"]}
          emptyText={listMode === "queue" ? "No rows in the pending queue" : "No withdrawals match filters"}
          footer={
            <AdminPagination
              page={safePage}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          }
        >
          {slice.map((withdrawal) => {
            const canApprove = ["pending", "claimable"].includes(withdrawal.status);
            const canPay = withdrawal.status === "approved";
            const canReject = ["pending", "claimable", "approved"].includes(withdrawal.status);
            const approving = processingId === `approve:${withdrawal._id}`;
            const paying = processingId === `pay:${withdrawal._id}`;
            const rejecting = processingId === `reject:${withdrawal._id}`;
            const st = String(withdrawal.status || "").toLowerCase();
            const badgeCls = withdrawalStatusClasses(st);

            return (
              <tr key={withdrawal._id} className="hover:bg-white/[0.03]">
                <td className="whitespace-nowrap px-4 py-4">
                  <div className="font-medium text-white">{getUserLabel(withdrawal.userId)}</div>
                  {withdrawal.userId?.email ? (
                    <div className="text-xs text-gray-500">{withdrawal.userId.email}</div>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-emerald-300 tabular-nums">
                  {formatCurrency(withdrawal.grossAmount)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sky-200 tabular-nums">
                  {formatCurrency(withdrawal.netAmount)}
                </td>
                <td className="max-w-[220px] px-4 py-4">
                  <span className="block truncate font-mono text-xs text-gray-300">
                    {withdrawal.walletAddress || "—"}
                  </span>
                  {withdrawal.txHash ? (
                    <span className="mt-1 block truncate font-mono text-[10px] text-gray-500">
                      tx: {withdrawal.txHash}
                    </span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs capitalize ${badgeCls}`}>
                    {st}
                  </span>
                </td>
                <td className="min-w-[260px] px-4 py-4">
                  <div className="flex flex-col gap-2">
                    {canApprove && (
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: "approve", row: withdrawal })}
                        disabled={Boolean(processingId) || confirmActionLoading}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {approving ? "Approving…" : "Approve"}
                      </button>
                    )}
                    {canPay && (
                      <div className="flex flex-col gap-2">
                        <input
                          className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
                          placeholder="Payout tx hash"
                          value={payTxById[withdrawal._id] || ""}
                          onChange={(e) =>
                            setPayTxById((prev) => ({
                              ...prev,
                              [withdrawal._id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          onClick={() => setConfirm({ kind: "pay", row: withdrawal })}
                          disabled={Boolean(processingId) || confirmActionLoading}
                          className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {paying ? "Saving…" : "Mark paid"}
                        </button>
                      </div>
                    )}
                    {canReject && (
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: "reject", row: withdrawal })}
                        disabled={Boolean(processingId) || confirmActionLoading}
                        className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {rejecting ? "Rejecting…" : "Reject & refund"}
                      </button>
                    )}
                    {!canApprove && !canPay && !canReject ? (
                      <span className="text-xs text-gray-500">No actions</span>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      <ConfirmModal
        open={Boolean(confirm)}
        title="Are you sure?"
        message={confirmMessage()}
        confirmLabel={
          confirm?.kind === "approve"
            ? "Yes, approve"
            : confirm?.kind === "reject"
              ? "Yes, reject"
              : "Yes, mark paid"
        }
        cancelLabel="Cancel"
        danger={confirm?.kind === "reject"}
        confirmLoading={confirmActionLoading}
        onCancel={() => !confirmActionLoading && setConfirm(null)}
        onConfirm={execConfirmed}
      />
    </AdminLayout>
  );
}

function StatusMessage({ type = "success", message }: { type?: string; message: string }) {
  if (!message) return null;

  const styles =
    type === "error"
      ? "border-red-500/20 bg-red-500/10 text-red-100"
      : "border-green-500/20 bg-green-500/10 text-green-100";

  return <div className={`mb-4 rounded-xl border p-3 text-sm ${styles}`}>{message}</div>;
}
