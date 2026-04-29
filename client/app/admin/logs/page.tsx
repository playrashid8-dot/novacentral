"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout, { adminFetch, formatDate } from "../../../components/admin/AdminLayout";
import Loader from "../../../components/admin/Loader";
import AdminPagination from "../../../components/admin/AdminPagination";
import { CARD } from "../../../lib/adminTheme";
import EmptyState from "../../../components/EmptyState";
import { showSafeToast } from "../../../lib/toast";
import { clearAdminLogs, getAdminLogs } from "../../../lib/adminActivityLog";
import ConfirmModal from "../../../components/admin/ConfirmModal";

const PAGE_SIZE = 25;

type Tab = "withdraw" | "salary" | "deposit" | "admin";

const TAB_LABEL: Record<Tab, string> = {
  withdraw: "Withdraw logs",
  salary: "Salary logs",
  deposit: "Deposit logs",
  admin: "Admin actions",
};

export default function AdminLogsPage() {
  const [tab, setTab] = useState<Tab>("admin");
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [localRows, setLocalRows] = useState<any[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLocalRows(getAdminLogs());
  }, []);

  const loadServer = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const qs = new URLSearchParams({
          type: tab,
          page: String(page),
          limit: String(PAGE_SIZE),
          search: debounced.trim(),
        });
        const payload = await adminFetch(`/admin/log-feed?${qs}`);
        const d = payload?.data;
        setItems(d?.items ?? []);
        setTotal(d?.total ?? 0);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load logs";
        if (!silent) showSafeToast(msg);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [tab, page, debounced]
  );

  useEffect(() => {
    void loadServer(false);
  }, [loadServer]);

  useEffect(() => {
    setPage(1);
  }, [tab, debounced]);

  const subtitle = useMemo(
    () =>
      tab === "admin"
        ? "Server-recorded admin actions (plus optional local browser log below)."
        : "Read-only feed from live collections.",
    [tab]
  );

  return (
    <AdminLayout title="System logs" subtitle={subtitle}>
      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(TAB_LABEL) as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === key
                ? "bg-purple-600 text-white"
                : "border border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/10"
            }`}
          >
            {TAB_LABEL[key]}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search username, action, tx…"
          className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-purple-500"
        />
      </div>

      {loading ? (
        <Loader label="Loading…" />
      ) : items.length === 0 ? (
        <EmptyState text="No log rows for this filter." />
      ) : (
        <div className={`${CARD} divide-y divide-white/10`}>
          {items.map((row) => (
            <div key={row.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                <span>{formatDate(row.at)}</span>
                {row.status ? <span className="rounded-md bg-white/10 px-2 py-0.5">{row.status}</span> : null}
              </div>
              <p className="mt-1 font-medium text-white">{row.action}</p>
              <p className="text-xs text-gray-400">User: {row.userLabel || "—"}</p>
              {row.txHash ? (
                <p className="mt-1 truncate font-mono text-[10px] text-gray-500">{row.txHash}</p>
              ) : null}
              {row.amount != null ? (
                <p className="text-xs text-emerald-300/90 tabular-nums">{Number(row.amount).toFixed(2)} USDT</p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {total > 0 ? (
        <div className="mt-4">
          <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </div>
      ) : null}

      <div className={`${CARD} mt-10 p-5`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Local browser log</h3>
            <p className="text-xs text-gray-500">
              {localRows.length} entr{localRows.length === 1 ? "y" : "ies"} on this device only
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-500/20"
          >
            Clear local
          </button>
        </div>
        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
          {localRows.length === 0 ? (
            <p className="text-sm text-gray-500">Empty.</p>
          ) : (
            localRows.slice(0, 50).map((row) => (
              <div
                key={row.id}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  row.level === "error"
                    ? "border-red-500/25 bg-red-500/5 text-red-100"
                    : "border-white/10 bg-black/25 text-gray-300"
                }`}
              >
                <span className="text-gray-500">{new Date(row.ts).toLocaleString()}</span>
                <div className="font-medium text-white">{row.action}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmClear}
        title="Clear local log?"
        message="Removes admin UI events stored in this browser only."
        confirmLabel="Clear"
        cancelLabel="Cancel"
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearAdminLogs();
          setConfirmClear(false);
          setLocalRows(getAdminLogs());
        }}
      >
        {null}
      </ConfirmModal>
    </AdminLayout>
  );
}
