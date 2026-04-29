"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getApiErrorMessage, suppressDuplicateCatchToast } from "../../lib/api";
import { logout } from "../../lib/auth";
import { fetchCurrentUser } from "../../lib/session";
import { claimHybridRoi, fetchHybridSummary } from "../../lib/hybrid";
import AppToast from "../../components/AppToast";
import ProtectedRoute from "../../components/ProtectedRoute";
import PageWrapper from "../../components/PageWrapper";

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [displayBalance, setDisplayBalance] = useState(0);
  const [toast, setToast] = useState("");
  const [hybrid, setHybrid] = useState<any>(null);
  const [roiLoading, setRoiLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  useEffect(() => {
    loadUser(false);

    const onFocus = () => loadUser(true);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const loadUser = async (silent: boolean) => {
    try {
      if (!silent) setLoading(true);
      const [data, hybridData] = await Promise.all([
        fetchCurrentUser(),
        fetchHybridSummary().catch(() => null),
      ]);
      if (!data) throw new Error("No user data");

      setUser(data);
      const dep = Number(hybridData?.depositBalance || 0);
      const rew = Number(hybridData?.rewardBalance || 0);
      const stake = Number(hybridData?.activeStakeAmount || 0);
      setDisplayBalance(dep + rew + stake);
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

  useEffect(() => {
    if (!hybrid?.nextRoiClaimAt || hybrid?.canClaimRoi) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [hybrid?.nextRoiClaimAt, hybrid?.canClaimRoi]);

  const currentVipLevel = Number(hybrid?.level ?? 0);
  const withdrawableUsd =
    Number(hybrid?.depositBalance ?? 0) + Number(hybrid?.rewardBalance ?? 0);
  const stakingUsd = Number(hybrid?.activeStakeAmount ?? 0);
  const totalEarnedUsd = Number(hybrid?.totalEarnings ?? user?.totalEarnings ?? 0);
  const roiRatePct = (Number(hybrid?.roiRate || 0) * 100).toFixed(2);
  const roiPrincipal = Number(hybrid?.roiPrincipalBase ?? 0);
  const canClaimRoi = hybrid?.canClaimRoi === true;
  const roiWaitLabel = (() => {
    void tick;
    const iso = hybrid?.nextRoiClaimAt;
    if (!iso || canClaimRoi) return canClaimRoi ? "Available now" : "";
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return "Available now";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  })();

  const handleClaimRoi = async () => {
    if (roiLoading || !canClaimRoi || currentVipLevel < 1) return;
    try {
      setRoiLoading(true);
      const result: any = await claimHybridRoi();
      showToast(
        result?.amount != null
          ? `ROI claimed: $${Number(result.amount).toFixed(2)}`
          : "ROI claimed successfully",
      );
      await loadUser(true);
    } catch (err: any) {
      if (!suppressDuplicateCatchToast(err)) {
        showToast(getApiErrorMessage(err, "Could not claim ROI"));
      }
    } finally {
      setRoiLoading(false);
    }
  };
    <ProtectedRoute>
      <PageWrapper
        loading={loading}
        data={user?._id}
        useSkeletonLoading
        emptyText="No data available"
      >
        <div className="relative w-full max-w-full overflow-x-hidden pb-3 text-white">
          <AppToast message={toast} />

          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-300/80">
                Portfolio
              </p>
              <h1 className="mt-0.5 bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-xl font-black text-transparent sm:text-2xl">
                Dashboard
              </h1>
            </div>

            <button
              type="button"
              onClick={logout}
              className="w-full shrink-0 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-200 shadow-sm transition hover:bg-red-500/20 sm:w-auto"
            >
              Logout
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="mt-4 flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-[#111827]/90 p-3 shadow-md ring-1 ring-white/[0.04] backdrop-blur-xl"
          >
            <div className="rounded-full bg-gradient-to-br from-[#6366F1] to-indigo-700 p-[2px] shadow-[0_0_16px_rgba(99,102,241,0.28)]">
              <Image src="/logo.png" alt="" width={44} height={44} className="rounded-full bg-black" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Welcome back</p>
              <h2 className="truncate text-base font-bold">{user?.username}</h2>
              <p className="text-[10px] text-gray-500">
                VIP {currentVipLevel} · Ref{" "}
                <span className="font-mono text-gray-400">
                  {user?._id ? String(user._id).slice(0, 8) : "—"}
                </span>
              </p>
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.05 } },
            }}
            className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3"
          >
            <MetricHeroCard
              title="Total balance"
              subtitle="Deposit + rewards + staking"
              value={`$${displayBalance.toFixed(2)}`}
              gradient="from-[#6366F1]/30 via-indigo-600/20 to-[#111827]"
              className="col-span-2"
            />
            <MetricHeroCard
              title="Deposit balance"
              subtitle="Liquid principal"
              value={`$${Number(hybrid?.depositBalance || 0).toFixed(2)}`}
              gradient="from-amber-500/15 via-[#6366F1]/10 to-[#111827]"
            />
            <MetricHeroCard
              title="Reward balance"
              subtitle="Earnings balance"
              value={`$${Number(hybrid?.rewardBalance || 0).toFixed(2)}`}
              gradient="from-emerald-500/12 via-[#6366F1]/10 to-[#111827]"
              accent="text-emerald-300/95"
            />
            <MetricHeroCard
              title="Staking balance"
              subtitle="Active plans"
              value={`$${stakingUsd.toFixed(2)}`}
              gradient="from-violet-500/15 via-indigo-600/12 to-[#111827]"
              accent="text-violet-200/95"
            />
            <MetricHeroCard
              title="Total earned"
              subtitle="All-time credited"
              value={`$${totalEarnedUsd.toFixed(2)}`}
              gradient="from-cyan-500/12 via-[#6366F1]/10 to-[#111827]"
              accent="text-cyan-200/95"
            />
            <MetricHeroCard
              title="Withdrawable"
              subtitle="Available to withdraw"
              value={`$${withdrawableUsd.toFixed(2)}`}
              gradient="from-cyan-500/15 via-indigo-600/15 to-[#111827]"
              className="col-span-2"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-lg border border-amber-400/20 bg-[#111827]/95 p-3.5 shadow-md ring-1 ring-amber-400/10 backdrop-blur-xl"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/80">
                  Daily ROI
                </p>
                <p className="mt-1 text-sm text-gray-300">
                  Rate <span className="font-bold text-white">{roiRatePct}%</span> · Principal{" "}
                  <span className="font-bold text-white">${roiPrincipal.toFixed(2)}</span>{" "}
                  <span className="text-gray-500">(deposit + active stakes)</span>
                </p>
                {!canClaimRoi && hybrid?.nextRoiClaimAt ? (
                  <p className="mt-1 text-[11px] text-amber-100/90">
                    Next claim in <span className="font-mono font-semibold">{roiWaitLabel}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-emerald-200/90">You can claim your daily ROI now.</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleClaimRoi}
                disabled={roiLoading || !canClaimRoi || currentVipLevel < 1}
                className="shrink-0 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-black text-black shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {roiLoading ? "Claiming…" : "Claim ROI"}
              </button>
            </div>
            {currentVipLevel < 1 && (
              <p className="mt-2 text-[11px] text-gray-500">Reach VIP 1 to unlock manual ROI claims.</p>
            )}
          </motion.div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Action label="Deposit" icon="↓" onClick={() => router.push("/deposit")} />
            <Action label="Withdraw" icon="↑" onClick={() => router.push("/withdrawal")} />
            <Action label="Stake" icon="◆" onClick={() => router.push("/staking")} />
          </div>

          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl shadow-md ring-1 ring-white/[0.04]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-purple-300/75">Recent Activity</p>
                <h3 className="text-sm font-bold">Account Pulse</h3>
              </div>
              <span className="rounded-full border border-green-400/20 bg-green-400/10 px-2 py-0.5 text-[9px] text-green-300">
                Live
              </span>
            </div>
            <div className="space-y-2">
              <Activity title="Balance Updated" value={`$${displayBalance.toFixed(2)}`} />
              <Activity
                title="Last claim profit"
                value={`$${Number(user?.todayProfit || 0).toFixed(2)}`}
              />
              <Activity title="Hybrid Deposits" value={`$${Number(hybrid?.depositBalance || 0).toFixed(2)}`} />
            </div>
          </div>
        </div>
      </PageWrapper>
    </ProtectedRoute>
  );
}

const metricCardVariants: Record<"hidden" | "show", { opacity: number; y: number }> = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 },
};

function MetricHeroCard({
  title,
  subtitle,
  value,
  gradient,
  accent = "text-white",
  className = "",
}: {
  title: string;
  subtitle: string;
  value: string;
  gradient: string;
  accent?: string;
  className?: string;
}) {
  return (
    <motion.div
      variants={metricCardVariants}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.008 }}
      className={`relative overflow-hidden rounded-lg border border-white/[0.07] bg-gradient-to-br p-3 shadow-md ring-1 ring-white/[0.04] ${gradient} ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(255,255,255,0.06),transparent_45%)]" />
      <p className="relative text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-400">{title}</p>
      <p className={`relative mt-2 text-xl font-black tracking-tight tabular-nums sm:text-2xl ${accent}`}>
        {value}
      </p>
      <p className="relative mt-1 text-[11px] leading-snug text-gray-500">{subtitle}</p>
    </motion.div>
  );
}

function Action({ label, icon, onClick }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-white/[0.08] bg-[#111827]/90 p-2 text-center shadow-sm backdrop-blur-xl transition hover:border-[#6366F1]/35 active:scale-[0.98]"
    >
      <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#6366F1] to-indigo-700 text-sm font-black text-white shadow-[0_2px_14px_rgba(99,102,241,0.28)]">
        {icon}
      </div>
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-gray-400">{label}</p>
    </button>
  );
}

function Activity({ title, value }: any) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-purple-400/90 shadow-[0_0_10px_rgba(168,85,247,0.4)]" />
        <p className="truncate text-[11px] text-gray-300">{title}</p>
      </div>
      <p className="shrink-0 pl-2 text-[11px] font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}
