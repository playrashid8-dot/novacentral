"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../components/admin/AdminLayout";
import { clearAdminLogs, getAdminLogs } from "../../../lib/adminActivityLog";
import ConfirmModal from "../../../components/admin/ConfirmModal";
import EmptyState from "../../../components/EmptyState";

const DISPLAY_CAP = 100;

export default function AdminLogsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = useCallback(() => {
    setRows(getAdminLogs());
  }, []);

  const visibleRows = useMemo(() => rows.slice(0, DISPLAY_CAP), [rows]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AdminLayout
      title="Activity log"
      subtitle="Recent admin actions and errors recorded in this browser (for quick audits)."
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-400">
          {rows.length} entr{rows.length === 1 ? "y" : "ies"} stored locally
        </p>
        <button
          type="button"
          onClick={() => setConfirmClear(true)}
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-500/20"
        >
          Clear log
        </button>
      </div>

      <div className="max-h-[min(75vh,820px)] space-y-2 overflow-y-auto overscroll-contain pr-1">
        {rows.length === 0 ? (
          <EmptyState text="No records found" />
        ) : (
          visibleRows.map((row) => (
            <div
              key={row.id}
              className={`rounded-xl border px-4 py-3 ${
                row.level === "error"
                  ? "border-red-500/25 bg-red-500/5"
                  : "border-white/10 bg-black/25"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    row.level === "error"
                      ? "bg-red-500/20 text-red-200"
                      : "bg-white/10 text-gray-300"
                  }`}
                >
                  {row.level === "error" ? "Error" : "Info"}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(row.ts).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 font-medium text-white">{row.action}</p>
              {row.detail ? <p className="mt-1 text-sm text-gray-400">{row.detail}</p> : null}
            </div>
          ))
        )}
      </div>

      <ConfirmModal
        open={confirmClear}
        title="Are you sure?"
        message="This removes all locally stored admin activity on this device. It does not change server data."
        confirmLabel="Clear log"
        cancelLabel="Cancel"
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearAdminLogs();
          setConfirmClear(false);
          refresh();
        }}
      />
    </AdminLayout>
  );
}
