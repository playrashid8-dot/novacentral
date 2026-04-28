"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLayout, {
  adminFetch,
  formatCurrency,
  getUserLabel,
} from "../../../components/admin/AdminLayout";
import Loader from "../../../components/admin/Loader";
import Table from "../../../components/admin/Table";
import AdminPagination from "../../../components/admin/AdminPagination";
import ConfirmModal from "../../../components/admin/ConfirmModal";
import { pushAdminLog } from "../../../lib/adminActivityLog";
import EmptyState from "../../../components/EmptyState";
import { showSafeToast } from "../../../lib/toast";

const PAGE_SIZE = 10;
const ROW_CAP = 100;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [processingId, setProcessingId] = useState("");
  const [confirm, setConfirm] = useState<
    null | { kind: "block" | "unblock"; user: any }
  >(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [confirmActionLoading, setConfirmActionLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let active = true;

    const loadUsers = async () => {
      try {
        setLoading(true);
        setError("");
        const payload = await adminFetch("/admin/users");
        const nextUsers = payload?.data?.users || payload?.users || [];
        if (active) setUsers(nextUsers);
      } catch (err: any) {
        if (active) {
          const msg = err?.message || "Failed to load users";
          setError(msg);
          showSafeToast(msg);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadUsers();

    return () => {
      active = false;
    };
  }, []);

  const safeUsers = useMemo(() => users.slice(0, ROW_CAP), [users]);

  const filteredUsers = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    return safeUsers.filter((user) => {
      const matchesSearch =
        !query ||
        user.username?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query);
      const status = user.isBlocked ? "blocked" : "active";
      const matchesStatus = statusFilter === "all" || statusFilter === status;

      return matchesSearch && matchesStatus;
    });
  }, [debouncedSearch, statusFilter, safeUsers]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, users.length]);

  const total = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = filteredUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const runBlockToggle = async () => {
    if (!confirm || confirmActionLoading) return;
    const { kind, user } = confirm;
    const id = user._id;
    if (!id || processingId) return;
    const path = kind === "block" ? `/admin/block/${id}` : `/admin/unblock/${id}`;
    try {
      setConfirmActionLoading(true);
      setProcessingId(id);
      setError("");
      await adminFetch(path, { method: "POST", body: JSON.stringify({}) });
      pushAdminLog({
        action: kind === "block" ? "User blocked" : "User unblocked",
        detail: getUserLabel(user),
      });
      setUsers((prev) =>
        prev.map((u) =>
          String(u._id) === String(id) ? { ...u, isBlocked: kind === "block" } : u
        )
      );
      setConfirm(null);
    } catch (err: any) {
      const msg = err?.message || "Request failed";
      setError(msg);
      showSafeToast(msg);
      pushAdminLog({ level: "error", action: "User block/unblock failed", detail: msg });
    } finally {
      setProcessingId("");
      setConfirmActionLoading(false);
    }
  };

  return (
    <AdminLayout
      title="User management"
      subtitle="Search accounts, filter by status, block or unblock with confirmation."
    >
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px]">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by username or email"
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-purple-500"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-xl border border-white/10 bg-[#0b0b0f] px-4 py-3 text-sm text-white outline-none focus:border-purple-500"
        >
          <option value="all">All users</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      <StatusMessage type="error" message={error} />

      {loading ? (
        <Loader label="Loading users…" />
      ) : !error && !users.length ? (
        <EmptyState text="No records found" />
      ) : (
        <Table
          columns={["Username", "Balance", "VIP", "Status", "Actions"]}
          emptyText="No users match your filters"
          footer={
            <AdminPagination
              page={safePage}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          }
        >
          {slice.map((user) => {
            const busy = processingId === user._id;
            return (
              <tr key={user._id} className="hover:bg-white/[0.03]">
                <td className="whitespace-nowrap px-4 py-4">
                  <div className="font-medium text-white">{user.username || "—"}</div>
                  <div className="text-xs text-gray-500">{user.email || "—"}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-emerald-300 tabular-nums">
                  {formatCurrency(user.balance)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-gray-300">
                  VIP {Number(user.vipLevel || 0)}
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs ${
                      user.isBlocked
                        ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/30"
                        : "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
                    }`}
                  >
                    {user.isBlocked ? "Blocked" : "Active"}
                  </span>
                </td>
                <td className="px-4 py-4">
                  {user.isBlocked ? (
                    <button
                      type="button"
                      disabled={Boolean(processingId) || confirmActionLoading}
                      onClick={() => setConfirm({ kind: "unblock", user })}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {busy ? "…" : "Unblock"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={Boolean(processingId) || confirmActionLoading}
                      onClick={() => setConfirm({ kind: "block", user })}
                      className="rounded-lg bg-amber-500/90 px-3 py-2 text-xs font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
                    >
                      {busy ? "…" : "Block"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      <ConfirmModal
        open={Boolean(confirm)}
        title="Are you sure?"
        message={
          confirm
            ? confirm.kind === "block"
              ? `Block ${getUserLabel(confirm.user)}? They will not be able to use the app until unblocked.`
              : `Unblock ${getUserLabel(confirm.user)} and restore normal access?`
            : ""
        }
        confirmLabel={confirm?.kind === "block" ? "Block user" : "Unblock user"}
        cancelLabel="Cancel"
        danger={confirm?.kind === "block"}
        confirmLoading={confirmActionLoading}
        onCancel={() => !confirmActionLoading && setConfirm(null)}
        onConfirm={runBlockToggle}
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
