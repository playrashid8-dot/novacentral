"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getApiErrorMessage } from "../../lib/api";
import { logout } from "../../lib/auth";
import { fetchCurrentUser } from "../../lib/session";
import { claimHybridRoi, claimHybridSalary, fetchHybridSummary } from "../../lib/hybrid";
import AppToast from "../../components/AppToast";
import ProtectedRoute from "../../components/ProtectedRoute";
import GradientButton from "../../components/GradientButton";
import StatCard from "../../components/StatCard";
import ProgressBar from "../../components/ProgressBar";
import PageSkeleton from "../../components/Skeleton";

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [displayBalance, setDisplayBalance] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [toast, setToast] = useState("");
  const [hybrid, setHybrid] = useState<any>(null);
  const [roiLoading, setRoiLoading] = useState(false);
  const [salaryLoading, setSalaryLoading] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  /* 🔐 AUTH */
  useEffect(() => {
    loadUser(false);

    const onFocus = () => loadUser(true);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  /* 📡 LOAD USER */
  const loadUser = async (silent: boolean) => {
    try {
      if (!silent) setLoading(true);
      const [data, hybridData] = await Promise.all([
        fetchCurrentUser(),
        fetchHybridSummary().catch(() => null),
      ]);
      if (!data) throw new Error("No user data");

      setUser(data);
      setDisplayBalance(
        Number(hybridData?.depositBalance || 0) + Number(hybridData?.rewardBalance || 0)
      );
      setHybrid(hybridData);
    } catch (err: any) {
      if (!silent) {
        showToast(getApiErrorMessage(err, "Session expired 🔒"));
      }
      logout();
    } finally {
      if (!silent) setLoading(false);
    }
  };

  /* 💰 LIVE BALANCE */
  useEffect(() => {
    setDisplayBalance(
      Number(hybrid?.depositBalance || 0) + Number(hybrid?.rewardBalance || 0)
    );
  }, [hybrid]);

  /* ⏱️ COOLDOWN */
  useEffect(() => {
    setCooldown(0);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;

    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldown]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  };

  const roiCooldownMs = hybrid?.lastDailyClaim
    ? Math.max(
        0,
        24 * 60 * 60 * 1000 - (Date.now() - new Date(hybrid.lastDailyClaim).getTime())
      )
    : 0;

  const currentVipLevel = Number(hybrid?.level ?? 0);
  const stage1Rule = hybrid?.salaryRules?.[0];
  const salaryDirectNeed = Number(stage1Rule?.directCount ?? 3);
  const salaryTeamNeed = Number(stage1Rule?.teamCount ?? 10);
  const totalEarnings = Number(
    user?.totalEarnings ??
      Number(hybrid?.rewardBalance ?? 0) + Number(user?.todayProfit ?? 0)
  );
  const salaryStage = Number(hybrid?.salaryStage || 0);
  const salaryReward = Number(
    hybrid?.salaryRules?.find((r: { stage?: number }) => Number(r?.stage) === salaryStage)
      ?.amount ?? 0
  );
  const directProgress = Number(hybrid?.salaryDirectCount || hybrid?.directCount || 0);
  const teamProgress = Number(hybrid?.salaryTeamCount || hybrid?.teamCount || 0);
  const activeStakes = (hybrid?.stakes || []).filter((stake: any) => stake.status === "active");

  const dailyRoiUsdEst =
    Number(hybrid?.activeStakeAmount ?? 0) * Number(hybrid?.roiRate ?? 0);
  const activeDepositsUsd = Number(hybrid?.depositBalance ?? 0);
  const withdrawableUsd =
    Number(hybrid?.depositBalance ?? 0) + Number(hybrid?.rewardBalance ?? 0);

  const handleClaimRoi = async () => {
    if (roiLoading) return;

    try {
      setRoiLoading(true);
      const result = await claimHybridRoi();
      showToast(`ROI claimed: $${Number(result?.amount || 0).toFixed(2)}`);
      await loadUser(true);
    } catch (err: any) {
      showToast(getApiErrorMessage(err, "Failed to claim ROI ❌"));
    } finally {
      setRoiLoading(false);
    }
  };

  const handleClaimSalary = async () => {
    if (salaryLoading) return;

    try {
      setSalaryLoading(true);
      const result = await claimHybridSalary();
      showToast(`Salary claimed: $${Number(result?.amount || salaryReward || 0).toFixed(2)}`);
      await loadUser(true);
    } catch (err: any) {
      showToast(getApiErrorMessage(err, "Failed to claim salary ❌"));
    } finally {
      setSalaryLoading(false);
    }
  };

  /* ⏳ LOADER */
  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-[70vh] w-full py-6">
          <PageSkeleton />
        </div>
      </ProtectedRoute>
    );
  }

  if (!user || !user?._id) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-16 text-center text-gray-400">
          <p className="text-sm">No data available</p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
    <div className="relative w-full max-w-full overflow-x-hidden pb-4 text-white">
      <AppToast message={toast} />

      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-indigo-300/80">
            Portfolio
          </p>
          <h1 className="mt-1 bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-2xl font-black text-transparent sm:text-3xl">
            Dashboard
          </h1>
        </div>

        <button
          type="button"
          onClick={logout}
          className="w-full shrink-0 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-xs font-semibold text-red-200 shadow-md transition hover:scale-[1.02] hover:bg-red-500/20 sm:w-auto"
        >
          Logout
        </button>
      </motion.div>

      {/* PROFILE */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="mt-6 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#111827]/90 p-3 shadow-lg ring-1 ring-white/[0.04] backdrop-blur-xl"
      >
        <div className="rounded-full bg-gradient-to-br from-[#6366F1] to-indigo-700 p-[2px] shadow-[0_0_24px_rgba(99,102,241,0.45)]">
          <Image src="/logo.png" alt="" width={52} height={52} className="rounded-full bg-black" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Welcome back</p>
          <h2 className="truncate text-lg font-bold">{user?.username}</h2>
          <p className="text-[11px] text-gray-500">
            VIP {currentVipLevel} · Ref{" "}
            <span className="font-mono text-gray-400">{user?._id ? String(user._id).slice(0, 8) : "—"}</span>
          </p>
        </div>
      </motion.div>

      {/* METRIC CARDS */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.07 } },
        }}
        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <MetricHeroCard
          title="Total balance"
          subtitle="Deposit + rewards"
          value={`$${displayBalance.toFixed(2)}`}
          gradient="from-[#6366F1]/40 via-indigo-600/25 to-[#111827]"
        />
        <MetricHeroCard
          title="Daily ROI"
          subtitle={`Est. +$${dailyRoiUsdEst.toFixed(2)} / day on stake`}
          value={`${(Number(hybrid?.roiRate ?? 0) * 100).toFixed(2)}%`}
          accent="text-emerald-400"
          gradient="from-emerald-500/25 via-[#6366F1]/15 to-[#111827]"
        />
        <MetricHeroCard
          title="Active deposits"
          subtitle="Principal on platform"
          value={`$${activeDepositsUsd.toFixed(2)}`}
          gradient="from-amber-500/20 via-[#6366F1]/10 to-[#111827]"
        />
        <MetricHeroCard
          title="Withdrawable"
          subtitle="Available to request"
          value={`$${withdrawableUsd.toFixed(2)}`}
          gradient="from-cyan-500/20 via-indigo-600/20 to-[#111827]"
        />
      </motion.div>

      <div className="mt-4 rounded-2xl border border-white/[0.06] bg-[#111827]/60 px-4 py-3 ring-1 ring-white/[0.04]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Lifetime earnings</p>
        <p className="mt-1 text-2xl font-black tracking-tight text-white">${totalEarnings.toFixed(2)}</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <MiniMetric title="Deposit balance" value={hybrid?.depositBalance} />
          <MiniMetric title="Reward balance" value={hybrid?.rewardBalance} />
          <MiniMetric title="Today profit" value={user?.todayProfit} />
        </div>
        {cooldown > 0 && (
          <p className="mt-3 text-xs font-medium text-amber-400">Withdraw in {formatTime(cooldown)}</p>
        )}
      </div>

      {/* 🔥 ACTION BUTTONS */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Action label="Deposit" icon="↓" onClick={() => router.push("/deposit")} />
        <Action label="Withdraw" icon="↑" onClick={() => router.push("/withdrawal")} />
        <Action label="Stake" icon="◆" onClick={() => router.push("/staking")} />
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-r from-cyan-500/20 via-[#6366F1]/25 to-fuchsia-500/20 p-[1px] shadow-[0_0_40px_rgba(99,102,241,0.15)]">
        <div className="rounded-[22px] bg-[#111827]/95 p-5 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-200/80">
                HybridEarn
              </p>
              <h3 className="mt-1 text-lg font-black text-white">HybridEarn Daily ROI</h3>
            </div>
            <span className="rounded-full border border-purple-300/20 bg-purple-500/10 px-3 py-1 text-[10px] font-semibold text-purple-100">
              VIP {currentVipLevel}
            </span>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-gray-400">Current ROI Rate</p>
                <p className="mt-1 text-sm font-bold text-cyan-300">
                  {(Number(hybrid?.roiRate ?? 0) * 100).toFixed(2)}% daily
                </p>
              </div>
              <GradientButton
                onClick={handleClaimRoi}
                disabled={roiLoading || Number(hybrid?.roiRate ?? 0) <= 0 || roiCooldownMs > 0}
                loading={roiLoading}
                className="w-auto px-4 py-3 text-xs"
              >
                {roiLoading ? "Claiming..." : "Claim ROI"}
              </GradientButton>
            </div>

            <p className="mt-3 text-[11px] text-gray-400">
              {roiCooldownMs > 0
                ? `Next claim in ${Math.ceil(roiCooldownMs / (60 * 60 * 1000))}h`
                : "ROI can be claimed once every 24 hours."}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 p-[1px] rounded-3xl bg-gradient-to-r from-yellow-400/70 via-purple-500/70 to-blue-500/70 shadow-[0_0_35px_rgba(234,179,8,0.18)]">
        <div className="bg-[#08080d]/90 p-5 rounded-3xl backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-yellow-200/80">
                Team Milestone
              </p>
              <h3 className="mt-1 text-lg font-black text-white">HybridEarn Salary Rewards</h3>
            </div>
            <span className="rounded-full border border-yellow-300/20 bg-yellow-400/10 px-3 py-1 text-[10px] font-semibold text-yellow-100">
              Stage {salaryStage || 0}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <MiniMetric title="Stage" value={salaryStage || 0} raw />
            <MiniMetric title="Reward" value={salaryReward} />
          </div>

          <GradientButton
            onClick={handleClaimSalary}
            loading={salaryLoading}
            disabled={salaryStage <= 0}
            className="mt-4"
          >
            {salaryLoading ? "Claiming..." : "Claim Salary Reward"}
          </GradientButton>
        </div>
      </div>

      {/* STATS — single row aligned with HybridEarn summary */}
      <div className="grid grid-cols-2 gap-3 mt-6">
        <StatCard title="Pending Withdraw" value={`$${Number(hybrid?.pendingWithdraw ?? 0).toFixed(2)}`} tone="purple" />
        <StatCard title="Active Stake" value={`$${Number(hybrid?.activeStakeAmount ?? 0).toFixed(2)}`} tone="cyan" />
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-200/80">Earning Engines</p>
            <h3 className="text-lg font-black">Live Account Cards</h3>
          </div>
          <span className="rounded-full border border-purple-300/20 bg-purple-500/10 px-3 py-1 text-[10px] font-bold text-purple-100">
            VIP {currentVipLevel}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <EngineCard title="Daily ROI" value={`${(Number(hybrid?.roiRate || 0) * 100).toFixed(2)}%`} hint={roiCooldownMs > 0 ? "Cooldown active" : "Ready window"} />
          <EngineCard title="Referral Income" value={`$${Number(hybrid?.referralEarnings || 0).toFixed(2)}`} hint={`${Number(hybrid?.directCount || 0)} direct`} />
          <EngineCard
            title="Salary Progress"
            value={`${directProgress}/${salaryDirectNeed}`}
            hint={`${teamProgress}/${salaryTeamNeed} team`}
          />
          <EngineCard title="Staking Active" value={`$${Number(hybrid?.activeStakeAmount || 0).toFixed(2)}`} hint={`${activeStakes.length} active stakes`} />
        </div>
        <div className="mt-4 space-y-3">
          <ProgressBar label="Direct" value={directProgress} max={salaryDirectNeed} />
          <ProgressBar label="Team" value={teamProgress} max={salaryTeamNeed} />
        </div>
      </div>

      {/* RECENT ACTIVITY */}
      <div className="mt-6 bg-white/[0.05] border border-white/10 rounded-2xl p-4 backdrop-blur-2xl shadow-[0_18px_55px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-purple-300/80">Recent Activity</p>
            <h3 className="font-bold text-lg">Account Pulse</h3>
          </div>
          <span className="text-[10px] rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1 text-green-300">
            Live
          </span>
        </div>
        <div className="space-y-3">
          <Activity title="Balance Updated" value={`$${displayBalance.toFixed(2)}`} />
          <Activity
            title="Last claim profit"
            value={`$${Number(user?.todayProfit || 0).toFixed(2)}`}
          />
          <Activity title="Hybrid Deposits" value={`$${Number(hybrid?.depositBalance || 0).toFixed(2)}`} />
        </div>
      </div>

    </div>
    </ProtectedRoute>
  );
}

const metricCardVariants: Record<"hidden" | "show", { opacity: number; y: number }> = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

function MetricHeroCard({
  title,
  subtitle,
  value,
  gradient,
  accent = "text-white",
}: {
  title: string;
  subtitle: string;
  value: string;
  gradient: string;
  accent?: string;
}) {
  return (
    <motion.div
      variants={metricCardVariants}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.01 }}
      className={`relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.05] ${gradient}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(255,255,255,0.09),transparent_50%)]" />
      <p className="relative text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">{title}</p>
      <p className={`relative mt-3 text-3xl font-black tracking-tight tabular-nums ${accent}`}>{value}</p>
      <p className="relative mt-2 text-xs leading-snug text-gray-500">{subtitle}</p>
    </motion.div>
  );
}

/* 🔘 ACTION */
function Action({ label, icon, onClick }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-white/[0.08] bg-[#111827]/90 p-3 text-center shadow-md backdrop-blur-xl transition hover:scale-105 hover:border-[#6366F1]/35 hover:shadow-[0_8px_30px_rgba(99,102,241,0.2)] active:scale-95"
    >
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#6366F1] to-indigo-700 text-lg font-black text-white shadow-[0_4px_24px_rgba(99,102,241,0.45)]">
        {icon}
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-300">{label}</p>
    </button>
  );
}

function MiniMetric({ title, value, raw = false }: any) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3 ring-1 ring-white/[0.04]">
      <p className="text-[10px] text-gray-500">{title}</p>
      <p className="mt-1 text-sm font-bold text-indigo-100">
        {raw ? value : `$${Number(value || 0).toFixed(2)}`}
      </p>
    </div>
  );
}

function Activity({ title, value }: any) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-3">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full bg-purple-400 shadow-[0_0_18px_rgba(168,85,247,0.8)]" />
        <p className="text-xs text-gray-300">{title}</p>
      </div>
      <p className="text-xs font-bold text-white">{value}</p>
    </div>
  );
}

function EngineCard({ title, value, hint }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{title}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
      <p className="mt-1 text-[11px] text-gray-500">{hint}</p>
    </div>
  );
}