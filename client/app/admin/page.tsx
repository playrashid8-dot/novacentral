"use client";

import { useEffect, useState } from "react";
import AdminLayout, {
  adminFetch,
  formatCurrency,
} from "../../components/admin/AdminLayout";
import Loader from "../../components/admin/Loader";
import StatCard from "../../components/admin/StatCard";

export default function AdminPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadStats = async () => {
      try {
        setLoading(true);
        setError("");
        const payload = await adminFetch("/admin/stats");
        const nextStats = payload?.data?.stats || payload?.stats || payload?.data || {};
        if (active) setStats(nextStats);
      } catch (err) {
        if (active) setError(err.message || "Failed to load dashboard stats");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadStats();

    return () => {
      active = false;
    };
  }, []);

  const totalVolume =
    stats?.totalVolume ?? stats?.totalBalance ?? stats?.totalEarnings ?? 0;

  return (
    <AdminLayout
      title="Dashboard"
      subtitle="Monitor system totals and admin activity from one place."
    >
      {loading ? (
        <Loader label="Loading stats..." />
      ) : error ? (
        <PanelMessage type="error" message={error} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Users" value={stats?.totalUsers || 0} hint="" />
          <StatCard title="Total Deposits" value={stats?.totalDeposits || 0} hint="" />
          <StatCard
            title="Total Withdrawals"
            value={stats?.totalWithdrawals || 0}
            hint=""
          />
          <StatCard title="Total Volume" value={formatCurrency(totalVolume)} hint="" />
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