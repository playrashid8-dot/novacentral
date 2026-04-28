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
import { depositStatusClasses } from "../../../components/admin/adminStatusClasses";
import EmptyState from "../../../components/EmptyState";
import { showSafeToast } from "../../../lib/toast";

const PAGE_SIZE = 10;
const ROW_CAP = 100;

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadDeposits = async () => {
    try {
      setLoading(true);
      setError("");
      const payload = await adminFetch("/admin/deposits");
      setDeposits(payload?.data?.deposits || payload?.deposits || []);
    } catch (err: any) {
      const msg = err?.message || "Failed to load deposits";
      setError(msg);
      showSafeToast(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeposits();
  }, []);

  const safeDeposits = useMemo(() => deposits.slice(0, ROW_CAP), [deposits]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return safeDeposits.filter((deposit) => {
      const st = String(deposit.status || "").toLowerCase();
      const okStatus = statusFilter === "all" || st === statusFilter;
      const user = deposit.userId;
      const label = getUserLabel(user).toLowerCase();
      const email = (user?.email || "").toLowerCase();
      const tx = (deposit.txHash || "").toLowerCase();
      const okSearch =
        !q || label.includes(q) || email.includes(q) || tx.includes(q);
      return okStatus && okSearch;
    });
  }, [safeDeposits, debouncedSearch, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, deposits.length]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <AdminLayout
      title="Deposit control"
      subtitle="Hybrid listener deposits — filter by pipeline status, search by user or tx hash."
    >
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search user, email, or tx hash"
          className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-purple-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#0b0b0f] px-4 py-3 text-sm text-white outline-none focus:border-purple-500 lg:w-48"
        >
          <option value="all">All statuses</option>
          <option value="detected">Detected (pending)</option>
          <option value="credited">Credited</option>
          <option value="swept">Swept</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <StatusMessage type="error" message={error} />

      {loading ? (
        <Loader label="Loading deposits…" />
      ) : !error && !deposits.length ? (
        <EmptyState text="No records found" />
      ) : (
        <Table
          columns={["User", "Amount", "txHash", "Status"]}
          emptyText="No deposits match your filters"
          footer={
            <AdminPagination
              page={safePage}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          }
        >
          {slice.map((deposit) => (
            <tr key={deposit._id} className="hover:bg-white/[0.03]">
              <td className="whitespace-nowrap px-4 py-4">
                <div className="font-medium text-white">{getUserLabel(deposit.userId)}</div>
                {deposit.userId?.email ? (
                  <div className="text-xs text-gray-500">{deposit.userId.email}</div>
                ) : null}
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-emerald-300 tabular-nums">
                {formatCurrency(deposit.amount)}
              </td>
              <td className="max-w-[min(320px,50vw)] px-4 py-4">
                <span className="font-mono text-xs text-gray-300 break-all">
                  {deposit.txHash || "—"}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-4">
                <StatusBadge status={deposit.status} />
              </td>
            </tr>
          ))}
        </Table>
      )}
    </AdminLayout>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "unknown").toLowerCase();
  const cls = depositStatusClasses(normalized);
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs capitalize ${cls}`}>
      {normalized}
    </span>
  );
}

function StatusMessage({ type = "error", message }) {
  if (!message) return null;

  const styles =
    type === "error"
      ? "border-red-500/20 bg-red-500/10 text-red-100"
      : "border-green-500/20 bg-green-500/10 text-green-100";

  return <div className={`mb-4 rounded-xl border p-3 text-sm ${styles}`}>{message}</div>;
}
