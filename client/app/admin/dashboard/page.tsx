"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminKpiCard from "../../../components/admin/AdminKpiCard";
import AdminLayout, { adminFetch, formatCurrency } from "../../../components/admin/AdminLayout";
import Loader from "../../../components/admin/Loader";
import {
  buildDepositDailySeries,
  buildUserGrowthSeries,
  buildWithdrawDailySeries,
} from "../../../lib/adminChartSeries";
import { getAdminLogs } from "../../../lib/adminActivityLog";
import { showToast } from "../../../lib/toast";

const ChartsLazy = dynamic(
  () => import("../../../components/admin/AdminAnalyticsCharts"),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 lg:grid-cols-1 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[320px] animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    ),
  }
);

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLogs(getAdminLogs().slice(0, 8));
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const [st, dep, wdr, pend, usr] = await Promise.all([
          adminFetch("/admin/stats"),
          adminFetch("/admin/deposits"),
          adminFetch("/admin/withdrawals"),
          adminFetch("/admin/withdrawals/pending"),
          adminFetch("/admin/users"),
        ]);
        if (!active) return;
        setStats(st?.data?.stats || st?.stats || {});
        setDeposits(dep?.data?.deposits || dep?.deposits || []);
        setWithdrawals(wdr?.data?.withdrawals || wdr?.withdrawals || []);
        setPendingList(pend?.data?.withdrawals || pend?.withdrawals || []);
        setUsers(usr?.data?.users || usr?.users || []);
      } catch (err: any) {
        if (active) {
          const msg = err?.message || "Failed to load dashboard";
          setError(msg);
          showToast(msg);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const pendingPipelineDeposits = useMemo(
    () => deposits.filter((d) => String(d.status).toLowerCase() === "detected").length,
    [deposits]
  );

  const pendingRequests = (pendingList?.length || 0) + pendingPipelineDeposits;

  const depositSeries = useMemo(() => buildDepositDailySeries(deposits, 14), [deposits]);
  const withdrawSeries = useMemo(() => buildWithdrawDailySeries(withdrawals, 14), [withdrawals]);
  const growthSeries = useMemo(() => buildUserGrowthSeries(users, 30), [users]);

  const totalVolumeHint = stats
    ? `Platform balance ${formatCurrency(stats.totalBalance ?? 0)} · Rewards ${formatCurrency(stats.totalEarnings ?? 0)}`
    : "";

  return (
    <AdminLayout
      title="Control panel"
      subtitle="KPIs, queues, and analytics — hybrid deposits & withdrawals at a glance."
    >
      {loading ? (
        <Loader label="Loading control panel…" />
      ) : error ? (
        <PanelMessage type="error" message={error} />
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminKpiCard
              variant="violet"
              title="Total users"
              value={stats?.totalUsers ?? 0}
              hint="All registered accounts"
            />
            <AdminKpiCard
              variant="emerald"
              title="Total deposits"
              value={stats?.totalDeposits ?? 0}
              hint="Credited / swept deposit records"
            />
            <AdminKpiCard
              variant="sky"
              title="Total withdrawals"
              value={stats?.totalWithdrawals ?? 0}
              hint="Completed (paid) payouts"
            />
            <AdminKpiCard
              variant="amber"
              title="Pending requests"
              value={pendingRequests}
              hint={`${pendingList?.length || 0} withdrawal row(s) in queue + ${pendingPipelineDeposits} detected deposit(s)`}
            />
          </div>

          <ChartsLazy
            depositSeries={depositSeries}
            withdrawSeries={withdrawSeries}
            growthSeries={growthSeries}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <h3 className="text-sm font-semibold text-white">Liquidity snapshot</h3>
              <p className="mt-1 text-xs text-gray-500">{totalVolumeHint}</p>
              <dl className="mt-4 grid gap-3 text-sm">
                <div className="flex justify-between gap-2 border-b border-white/5 pb-2">
                  <dt className="text-gray-400">Total balance (users)</dt>
                  <dd className="font-medium text-emerald-300 tabular-nums">
                    {formatCurrency(stats?.totalBalance ?? 0)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-white/5 pb-2">
                  <dt className="text-gray-400">Total earnings (users)</dt>
                  <dd className="font-medium text-sky-300 tabular-nums">
                    {formatCurrency(stats?.totalEarnings ?? 0)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">Recent activity</h3>
                <Link
                  href="/admin/logs"
                  className="text-xs font-medium text-purple-300 hover:text-purple-200"
                >
                  View all
                </Link>
              </div>
              <p className="mt-1 text-xs text-gray-500">Local log of admin clicks & API results on this browser</p>
              <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1 text-sm">
                {logs.length === 0 ? (
                  <li className="text-gray-500">No entries yet — actions will appear here.</li>
                ) : (
                  logs.map((row) => (
                    <li
                      key={row.id}
                      className={`rounded-lg border px-3 py-2 ${
                        row.level === "error"
                          ? "border-red-500/25 bg-red-500/5 text-red-100"
                          : "border-white/10 bg-black/20 text-gray-200"
                      }`}
                    >
                      <span className="text-xs text-gray-500">
                        {new Date(row.ts).toLocaleString()}
                      </span>
                      <div className="font-medium">{row.action}</div>
                      {row.detail ? <div className="text-xs text-gray-400">{row.detail}</div> : null}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function PanelMessage({ type = "info", message }: { type?: string; message: string }) {
  const styles =
    type === "error"
      ? "border-red-500/20 bg-red-500/10 text-red-100"
      : "border-white/10 bg-white/[0.04] text-gray-300";

  return <div className={`rounded-2xl border p-4 text-sm ${styles}`}>{message}</div>;
}
