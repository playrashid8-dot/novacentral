"use client";

import { useEffect, useState } from "react";
import AdminLayout, {
  adminFetch,
  formatCurrency,
  getUserLabel,
} from "../../../components/admin/AdminLayout";
import Loader from "../../../components/admin/Loader";
import Table from "../../../components/admin/Table";

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState("");
  const [payTxById, setPayTxById] = useState({});

  const loadWithdrawals = async () => {
    try {
      setLoading(true);
      setError("");
      const payload = await adminFetch("/admin/withdrawals/pending");
      setWithdrawals(payload?.data?.withdrawals || payload?.withdrawals || []);
    } catch (err) {
      setError(err.message || "Failed to load withdrawals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const approve = async (id) => {
    if (processingId) return;
    try {
      setProcessingId(`approve:${id}`);
      setMessage("");
      setError("");
      await adminFetch("/admin/hybrid/withdraw/approve", {
        method: "POST",
        body: JSON.stringify({ withdrawalId: id }),
      });
      setMessage("Withdrawal approved");
      await loadWithdrawals();
    } catch (err) {
      setError(err.message || "Failed to approve");
    } finally {
      setProcessingId("");
    }
  };

  const markPaid = async (id) => {
    if (processingId) return;
    const txHash = String(payTxById[id] || "").trim();
    if (!txHash) {
      setError("Enter a transaction hash before marking paid");
      return;
    }
    try {
      setProcessingId(`pay:${id}`);
      setMessage("");
      setError("");
      await adminFetch("/admin/hybrid/withdraw/pay", {
        method: "POST",
        body: JSON.stringify({ withdrawalId: id, txHash }),
      });
      setMessage("Marked as paid");
      setPayTxById((prev) => ({ ...prev, [id]: "" }));
      await loadWithdrawals();
    } catch (err) {
      setError(err.message || "Failed to mark paid");
    } finally {
      setProcessingId("");
    }
  };

  const reject = async (id) => {
    if (processingId) return;
    try {
      setProcessingId(`reject:${id}`);
      setMessage("");
      setError("");
      await adminFetch("/admin/hybrid/withdraw/reject", {
        method: "POST",
        body: JSON.stringify({ withdrawalId: id }),
      });
      setMessage("Withdrawal rejected");
      await loadWithdrawals();
    } catch (err) {
      setError(err.message || "Failed to reject");
    } finally {
      setProcessingId("");
    }
  };

  return (
    <AdminLayout
      title="Hybrid withdrawals"
      subtitle="Approve after the 96h lock, send USDT manually, then record the tx hash."
    >
      <StatusMessage message={message} />
      <StatusMessage type="error" message={error} />

      {loading ? (
        <Loader label="Loading withdrawals..." />
      ) : (
        <Table
          columns={["User", "Gross", "Net", "Wallet", "Status", "Actions"]}
          emptyText="No pending hybrid withdrawals"
        >
          {withdrawals.map((withdrawal) => {
            const canApprove = ["pending", "claimable"].includes(withdrawal.status);
            const canPay = withdrawal.status === "approved";
            const canReject = ["pending", "claimable", "approved"].includes(withdrawal.status);
            const approving = processingId === `approve:${withdrawal._id}`;
            const paying = processingId === `pay:${withdrawal._id}`;
            const rejecting = processingId === `reject:${withdrawal._id}`;

            return (
              <tr key={withdrawal._id} className="hover:bg-white/[0.03]">
                <td className="whitespace-nowrap px-4 py-4">
                  <div className="font-medium text-white">
                    {getUserLabel(withdrawal.userId)}
                  </div>
                  {withdrawal.userId?.email ? (
                    <div className="text-xs text-gray-500">
                      {withdrawal.userId.email}
                    </div>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-green-300">
                  {formatCurrency(withdrawal.grossAmount)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-cyan-200">
                  {formatCurrency(withdrawal.netAmount)}
                </td>
                <td className="max-w-[220px] px-4 py-4">
                  <span className="block truncate text-gray-300">
                    {withdrawal.walletAddress || "-"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <StatusBadge status={withdrawal.status} />
                </td>
                <td className="min-w-[260px] px-4 py-4">
                  <div className="flex flex-col gap-2">
                    {canApprove && (
                      <button
                        type="button"
                        onClick={() => approve(withdrawal._id)}
                        disabled={Boolean(processingId)}
                        className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {approving ? "Approving..." : "Approve"}
                      </button>
                    )}
                    {canPay && (
                      <div className="flex flex-col gap-2">
                        <input
                          className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white"
                          placeholder="Paste payout tx hash"
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
                          onClick={() => markPaid(withdrawal._id)}
                          disabled={Boolean(processingId)}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {paying ? "Saving..." : "Mark paid"}
                        </button>
                      </div>
                    )}
                    {canReject && (
                      <button
                        type="button"
                        onClick={() => reject(withdrawal._id)}
                        disabled={Boolean(processingId)}
                        className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {rejecting ? "Rejecting..." : "Reject & refund"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </AdminLayout>
  );
}

function StatusBadge({ status }) {
  const normalized = status || "unknown";
  const color =
    normalized === "paid" || normalized === "claimed"
      ? "bg-green-500/15 text-green-300"
      : normalized === "rejected"
        ? "bg-red-500/15 text-red-300"
        : normalized === "approved"
          ? "bg-blue-500/15 text-blue-200"
          : "bg-yellow-500/15 text-yellow-300";

  return (
    <span className={`rounded-full px-3 py-1 text-xs capitalize ${color}`}>
      {normalized}
    </span>
  );
}

function StatusMessage({ type = "success", message }) {
  if (!message) return null;

  const styles =
    type === "error"
      ? "border-red-500/20 bg-red-500/10 text-red-100"
      : "border-green-500/20 bg-green-500/10 text-green-100";

  return <div className={`mb-4 rounded-xl border p-3 text-sm ${styles}`}>{message}</div>;
}
