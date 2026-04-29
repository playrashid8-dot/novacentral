"use client";

import { useCallback, useEffect, useMemo, useState, memo } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getApiErrorMessage, suppressDuplicateCatchToast } from "../../lib/api";
import { logout } from "../../lib/auth";
import { fetchCurrentUser } from "../../lib/session";
import { claimHybridRoi, fetchHybridSummary, fetchHybridWithdrawals } from "../../lib/hybrid";
import { useAnimatedNumber } from "../../lib/useAnimatedNumber";
import AppToast from "../../components/AppToast";
import ProtectedRoute from "../../components/ProtectedRoute";
import PageWrapper from "../../components/PageWrapper";
import VipBadge from "../../components/ui/VipBadge";
import LiveRefreshIndicator from "../../components/LiveRefreshIndicator";
import { getWithdrawalStatusLabel } from "../../lib/withdrawUi";

const MiniEarningsChart = dynamic(() => import("../../components/MiniEarningsChart"), {
  ssr: false,
  loading: () => (
    <div className="mt-3 h-[112px] w-full animate-pulse rounded-xl bg-white/10" aria-hidden />
  ),
});

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [displayBalance, setDisplayBalance] = useState(0);
  const [toast, setToast] = useState("");
  const [toastTone, setToastTone] = useState<"neutral" | "success" | "error">("neutral");
  const [hybrid, setHybrid] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [roiLoading, setRoiLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const showToast = (msg: string, tone: "neutral" | "success" | "error" = "neutral") => {
    setToast(msg);
    setToastTone(tone);
    setTimeout(() => {
      setToast("");
      setToastTone("neutral");
    }, 2500);
  };

  const loadUser = useCallback(async (silent: boolean) => {
    try {
      if (!silent) setLoading(true);
      const [data, hybridData, withdrawalRows] = await Promise.all([
        fetchCurrentUser(),
        fetchHybridSummary().catch(() => null),
        fetchHybridWithdrawals().catch(() => []),
      ]);
      if (!data) throw new Error("No user data");

      setUser(data);
      setWithdrawals(Array.isArray(withdrawalRows) ? withdrawalRows : []);
      const dep = Number(hybridData?.depositBalance || 0);
      const rew = Number(hybridData?.rewardBalance || 0);
      const stake = Number(hybridData?.activeStakeAmount || 0);
      setDisplayBalance(dep + rew + stake);
      setHybrid(hybridData);
      setLastUpdatedAt(Date.now());
    } catch (err: any) {
      if (!silent) {
        showToast(getApiErrorMessage(err, "Session expired 🔒"), "error");
      }
      logout();
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser(false);

    const onFocus = () => void loadUser(true);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, [loadUser]);

  useEffect(() => {
    const id = window.setInterval(() => void loadUser(true), 18000);
    return () => clearInterval(id);
  }, [loadUser]);

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
  const activeStakesCount = useMemo(
    () => (hybrid?.stakes || []).filter((s: any) => String(s?.status || "").toLowerCase() === "active").length,
    [hybrid]
  );
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

  const depositActivityChart = useMemo(() => {
    const deposits = hybrid?.deposits || [];
    const keys = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      keys.push(d.toISOString().slice(0, 10));
    }
    const byDay = Object.fromEntries(keys.map((k) => [k, 0]));
    for (const dep of deposits) {
      const day = dep?.createdAt ? new Date(dep.createdAt).toISOString().slice(0, 10) : null;
      if (day && Object.prototype.hasOwnProperty.call(byDay, day)) {
        byDay[day] += Number(dep.amount || 0);
      }
    }
    return keys.map((k) => ({ label: k.slice(5), value: Number(byDay[k] || 0) }));
  }, [hybrid]);

  const sortedDeposits = useMemo(() => {
    const list = [...(hybrid?.deposits || [])];
    return list.sort((a, b) => {
      const ta = new Date(a?.createdAt ?? 0).getTime();
      const tb = new Date(b?.createdAt ?? 0).getTime();
      return tb - ta;
    });
  }, [hybrid?.deposits]);

  const sortedWithdrawalsDash = useMemo(() => {
    const list = [...withdrawals];
    return list.sort((a, b) => {
      const ta = new Date(a?.createdAt ?? 0).getTime();
      const tb = new Date(b?.createdAt ?? 0).getTime();
      return tb - ta;
    });
  }, [withdrawals]);

  const lastDeposit = sortedDeposits[0];
  const lastWithdrawal = sortedWithdrawalsDash[0];

  const activityFeed = useMemo(() => {
    type Row = { key: string; ts: number; title: string; subtitle: string; accent: string };
    const rows: Row[] = [];
    for (const d of hybrid?.deposits || []) {
      const amt = Number(d.amount ?? 0).toFixed(2);
      rows.push({
        key: `dep-${String(d._id)}`,
        ts: new Date(d.createdAt || 0).getTime(),
        title: `+$${amt} USDT credited`,
        subtitle: d.status ? String(d.status) : "Hybrid deposit",
        accent: "text-emerald-300",
      });
    }
    for (const w of withdrawals || []) {
      const net = Number(w.netAmount ?? 0).toFixed(2);
      rows.push({
        key: `wd-${String(w._id)}`,
        ts: new Date(w.createdAt || 0).getTime(),
        title: `Withdrawal ${getWithdrawalStatusLabel(w.status)}`,
        subtitle: `$${net} USDT`,
        accent: "text-sky-200",
      });
    }
    return rows.sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [hybrid?.deposits, withdrawals]);

  const animBalance = useAnimatedNumber(displayBalance, 1100);
  const animEarned = useAnimatedNumber(totalEarnedUsd, 1100);
  const animWithdrawable = useAnimatedNumber(withdrawableUsd, 1100);

  const handleClaimRoi = async () => {
    if (roiLoading || !canClaimRoi || currentVipLevel < 1) return;
    try {
      setRoiLoading(true);
      const result: any = await claimHybridRoi();
      showToast(
        result?.amount != null
          ? `ROI claimed: $${Number(result.amount).toFixed(2)}`
          : "ROI claimed successfully",
        "success",
      );
      await loadUser(true);
    } catch (err: any) {
      if (!suppressDuplicateCatchToast(err)) {
        showToast(getApiErrorMessage(err, "Could not claim ROI"), "error");
      }
    } finally {
      setRoiLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <PageWrapper
        loading={loading}
        data={user?._id}
        useSkeletonLoading
        emptyText="No data available"
      >
        <div className="relative w-full max-w-full overflow-x-hidden pb-3 text-white">
          <AppToast message={toast} tone={toastTone} />

          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-400/85">
                Portfolio
              </p>
              <h1 className="mt-0.5 bg-gradient-to-r from-white via-emerald-200 to-blue-300 bg-clip-text text-xl font-black text-transparent sm:text-2xl">
                Dashboard
              </h1>
            </div>

            <div className="flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:items-end">
              <LiveRefreshIndicator lastUpdatedAt={lastUpdatedAt} />
              <button
                type="button"
                onClick={logout}
                className="w-full shrink-0 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-[11px] font-semibold text-red-200 shadow-soft transition hover:bg-red-500/20 sm:w-auto sm:min-w-[120px]"
              >
                Logout
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="mt-4 flex items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-card p-4 shadow-soft backdrop-blur-xl"
          >
            <div className="rounded-full bg-gradient-to-br from-emerald-500 to-green-600 p-[2px] shadow-[0_0_20px_rgba(16,185,129,0.35)]">
              <Image src="/logo.png" alt="" width={44} height={44} className="rounded-full bg-black" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Welcome back</p>
              <h2 className="truncate text-base font-bold">{user?.username}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <VipBadge level={currentVipLevel} showGlow={currentVipLevel >= 1} />
                <span className="text-[10px] text-gray-500">
                  Ref{" "}
                  <span className="font-mono text-gray-400">
                    {user?._id ? String(user._id).slice(0, 8) : "—"}
                  </span>
                </span>
              </div>
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
              value={`$${animBalance.toFixed(2)}`}
              gradient="from-emerald-500/25 via-[#0f1629] to-blue-600/15"
              highlight
              className="col-span-2"
            />
            <MetricHeroCard
              title="Deposit balance"
              subtitle="Liquid principal"
              value={`$${Number(hybrid?.depositBalance || 0).toFixed(2)}`}
              gradient="from-amber-500/15 via-emerald-900/10 to-[#111827]"
            />
            <MetricHeroCard
              title="Reward balance"
              subtitle="Earnings balance"
              value={`$${Number(hybrid?.rewardBalance || 0).toFixed(2)}`}
              gradient="from-emerald-500/12 via-[#0f1629] to-[#111827]"
              accent="text-emerald-300/95"
            />
            <MetricHeroCard
              title="Active plan"
              subtitle={`${activeStakesCount} live stake(s) · HybridEarn`}
              value={`$${stakingUsd.toFixed(2)}`}
              gradient="from-blue-500/15 via-emerald-900/10 to-[#111827]"
              accent="text-blue-200/95"
            />
            <MetricHeroCard
              title="Total earned"
              subtitle="All-time credited"
              value={`$${animEarned.toFixed(2)}`}
              gradient="from-cyan-500/12 via-emerald-900/10 to-[#111827]"
              accent="text-cyan-200/95"
            />
            <MetricHeroCard
              title="Withdrawable"
              subtitle="Available to withdraw"
              value={`$${animWithdrawable.toFixed(2)}`}
              gradient="from-emerald-500/15 via-blue-900/10 to-[#111827]"
              className="col-span-2"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-2xl border border-white/[0.08] bg-card p-4 shadow-soft"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400/85">
                  7-day deposit pulse
                </p>
                <p className="text-xs text-gray-500">On-chain top-ups credited to hybrid</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/[0.15] px-2.5 py-0.5 text-[9px] font-bold text-emerald-100 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
                  <span className="relative block h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                </span>
                Live
              </span>
            </div>
            <MiniEarningsChart data={depositActivityChart} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
          >
            <div className="rounded-2xl border border-white/[0.08] bg-card/90 p-4 shadow-soft ring-1 ring-white/[0.04] transition hover:border-emerald-500/20">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-500">Last deposit</p>
              <p className="mt-1.5 text-lg font-black tabular-nums text-white">
                {lastDeposit
                  ? `$${Number(lastDeposit.amount ?? 0).toFixed(2)}`
                  : "—"}
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                {lastDeposit?.createdAt
                  ? new Date(lastDeposit.createdAt).toLocaleString()
                  : "No deposits yet"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-card/90 p-4 shadow-soft ring-1 ring-white/[0.04] transition hover:border-sky-500/20">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-500">Last withdrawal</p>
              <p className="mt-1.5 text-lg font-black tabular-nums text-white">
                {lastWithdrawal ? `$${Number(lastWithdrawal.netAmount ?? 0).toFixed(2)}` : "—"}
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                {lastWithdrawal?.createdAt
                  ? `${getWithdrawalStatusLabel(lastWithdrawal.status)} · ${new Date(lastWithdrawal.createdAt).toLocaleString()}`
                  : "No withdrawals yet"}
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-2xl border border-amber-400/20 bg-card p-4 shadow-soft ring-1 ring-amber-400/10 backdrop-blur-xl"
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
                className="inline-flex shrink-0 min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-400 px-5 py-3 text-sm font-black text-gray-950 shadow-glow-emerald transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {roiLoading ? (
                  <>
                    <span
                      className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-gray-900/35 border-t-gray-900"
                      aria-hidden
                    />
                    Claiming…
                  </>
                ) : (
                  "Claim ROI"
                )}
              </button>
            </div>
            {currentVipLevel < 1 && (
              <p className="mt-2 text-[11px] text-gray-500">Reach VIP 1 to unlock manual ROI claims.</p>
            )}
          </motion.div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            <Action label="Deposit" icon="↓" onClick={() => router.push("/deposit")} />
            <Action label="Withdraw" icon="↑" onClick={() => router.push("/withdraw")} />
            <Action label="Stake" icon="◆" onClick={() => router.push("/staking")} />
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-card p-4 shadow-soft backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400/75">Recent Activity</p>
                <h3 className="text-sm font-bold">Account Pulse</h3>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.12] px-2.5 py-0.5 text-[9px] font-bold text-emerald-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                Live
              </span>
            </div>
            <div className="space-y-2">
              <Activity title="Total balance (live)" value={`$${displayBalance.toFixed(2)}`} />
              <Activity
                title="Today’s profit"
                value={`$${Number(user?.todayProfit || 0).toFixed(2)}`}
              />
              {activityFeed.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 transition hover:border-emerald-500/18"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400/90 shadow-[0_0_10px_rgba(16,185,129,0.45)]" />
                    <div className="min-w-0">
                      <p className={`truncate text-[11px] font-semibold ${row.accent}`}>{row.title}</p>
                      <p className="truncate text-[10px] text-gray-500">{row.subtitle}</p>
                    </div>
                  </div>
                </div>
              ))}
              {activityFeed.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 bg-black/20 px-3 py-4 text-center text-xs text-gray-500">
                  No recent movements yet. Make a deposit to see live credits here.
                </p>
              ) : null}
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

const MetricHeroCard = memo(function MetricHeroCard({
  title,
  subtitle,
  value,
  gradient,
  accent = "text-white",
  className = "",
  highlight = false,
}: {
  title: string;
  subtitle: string;
  value: string;
  gradient: string;
  accent?: string;
  className?: string;
  highlight?: boolean;
}) {
  return (
    <motion.div
      variants={metricCardVariants}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.008 }}
      className={`relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br p-4 shadow-soft ring-1 ring-white/[0.04] ${
        highlight ? "shadow-glow-emerald ring-emerald-500/25" : ""
      } ${gradient} ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(255,255,255,0.06),transparent_45%)]" />
      <p className="relative text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-400">{title}</p>
      <p className={`relative mt-2 text-xl font-black tracking-tight tabular-nums sm:text-2xl ${accent}`}>
        {value}
      </p>
      <p className="relative mt-1 text-[11px] leading-snug text-gray-500">{subtitle}</p>
    </motion.div>
  );
});

function Action({ label, icon, onClick }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[52px] rounded-2xl border border-white/[0.08] bg-card p-2.5 text-center shadow-soft backdrop-blur-xl transition hover:border-emerald-500/35 active:scale-[0.98]"
    >
      <div className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 text-sm font-black text-gray-950 shadow-[0_2px_14px_rgba(16,185,129,0.35)]">
        {icon}
      </div>
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-gray-400">{label}</p>
    </button>
  );
}

const Activity = memo(function Activity({ title, value }: any) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 transition hover:border-emerald-500/15">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400/90 shadow-[0_0_10px_rgba(16,185,129,0.45)]" />
        <p className="truncate text-[11px] text-gray-300">{title}</p>
      </div>
      <p className="shrink-0 pl-2 text-[11px] font-bold text-white tabular-nums">{value}</p>
    </div>
  );
});
