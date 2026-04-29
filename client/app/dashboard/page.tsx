"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { getApiErrorMessage, suppressDuplicateCatchToast } from "../../lib/api";
import { logout } from "../../lib/auth";
import { fetchCurrentUser } from "../../lib/session";
import { claimHybridRoi, fetchHybridSummary } from "../../lib/hybrid";
import { useAnimatedNumber } from "../../lib/useAnimatedNumber";
import AppToast from "../../components/AppToast";
import ProtectedRoute from "../../components/ProtectedRoute";
import PageWrapper from "../../components/PageWrapper";
import LiveRefreshIndicator from "../../components/LiveRefreshIndicator";

const CARD = "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl";

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [toastTone, setToastTone] = useState<"neutral" | "success" | "error">("neutral");
  const [hybrid, setHybrid] = useState<any>(null);
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
      const [data, hybridData] = await Promise.all([
        fetchCurrentUser(),
        fetchHybridSummary().catch(() => null),
      ]);
      if (!data) throw new Error("No user data");

      setUser(data);
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
    const id = window.setInterval(() => void loadUser(true), 15000);
    return () => clearInterval(id);
  }, [loadUser]);

  useEffect(() => {
    if (!hybrid?.nextRoiClaimAt || hybrid?.canClaimRoi) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [hybrid?.nextRoiClaimAt, hybrid?.canClaimRoi]);

  const currentVipLevel = Number(hybrid?.level ?? 0);
  const totalEarnedUsd = Number(hybrid?.totalEarnings ?? user?.totalEarnings ?? 0);
  const depositUsd = Number(hybrid?.depositBalance ?? 0);
  const stakingUsd = Number(hybrid?.activeStakeAmount ?? 0);
  const roiRatePct = (Number(hybrid?.roiRate || 0) * 100).toFixed(2);
  const roiPrincipal = Number(hybrid?.roiPrincipalBase ?? 0);
  const canClaimRoi = hybrid?.canClaimRoi === true;

  const roiWaitLabel = (() => {
    void tick;
    const iso = hybrid?.nextRoiClaimAt;
    if (!iso || canClaimRoi) return canClaimRoi ? "Ready" : "";
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return "Ready";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (h >= 1) return `${h}h ${m}m`;
    if (m >= 1) return `${m}m ${s}s`;
    return `${s}s`;
  })();

  const animEarned = useAnimatedNumber(totalEarnedUsd, 1100);

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
        <div className="relative w-full max-w-full overflow-x-hidden px-1 pb-3 text-white sm:px-0">
          <AppToast message={toast} tone={toastTone} />

          <motion.header
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white sm:text-2xl">HybridEarn</h1>
              <p className="mt-0.5 text-[11px] text-gray-400 sm:text-xs">Smart Income Dashboard</p>
            </div>
            <LiveRefreshIndicator lastUpdatedAt={lastUpdatedAt} className="sm:pt-1" />
          </motion.header>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="mt-5 grid grid-cols-1 gap-2.5 sm:mt-6 sm:grid-cols-3 sm:gap-3"
          >
            <StatTile cardClassName={CARD} label="Deposit Balance" value={`$${depositUsd.toFixed(2)}`} />
            <StatTile cardClassName={CARD} label="Active Plan" value={`$${stakingUsd.toFixed(2)}`} />
            <StatTile cardClassName={CARD} label="Total Earned" value={`$${animEarned.toFixed(2)}`} accent />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className={`mt-5 p-4 shadow-[0_8px_40px_rgba(0,0,0,0.25)] transition duration-300 hover:scale-[1.01] sm:p-5 ${CARD}`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400/85">
              Daily ROI
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span className="text-gray-400">
                    Rate: <span className="font-bold text-white">{roiRatePct}%</span>
                  </span>
                  <span className="text-gray-400">
                    Principal: <span className="font-bold tabular-nums text-white">${roiPrincipal.toFixed(2)}</span>
                  </span>
                </div>
                {!canClaimRoi && hybrid?.nextRoiClaimAt ? (
                  <p className="text-sm text-gray-400">
                    Next claim: <span className="font-mono font-semibold text-emerald-200/95">{roiWaitLabel}</span>
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-emerald-200/95">Ready to claim</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleClaimRoi}
                disabled={roiLoading || !canClaimRoi || currentVipLevel < 1}
                className="inline-flex min-h-[48px] w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-400 px-6 py-3 text-sm font-black text-gray-950 shadow-[0_0_28px_rgba(16,185,129,0.35)] transition duration-300 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
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
              <p className="mt-3 text-[11px] text-gray-500">Reach VIP 1 to unlock manual ROI claims.</p>
            )}
          </motion.div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
            <QuickAction label="Deposit" icon="↓" onClick={() => router.push("/deposit")} />
            <QuickAction label="Withdraw" icon="↑" onClick={() => router.push("/withdraw")} />
            <QuickAction label="Stake" icon="◆" onClick={() => router.push("/staking")} />
            <QuickAction label="Team" icon="👥" onClick={() => router.push("/team")} />
          </div>
        </div>
      </PageWrapper>
    </ProtectedRoute>
  );
}

function StatTile({
  label,
  value,
  accent,
  cardClassName,
}: {
  label: string;
  value: string;
  accent?: boolean;
  cardClassName: string;
}) {
  return (
    <div
      className={`${cardClassName} p-3 transition duration-300 hover:scale-[1.02] sm:p-4 ${
        accent ? "shadow-[0_0_25px_rgba(16,185,129,0.35)]" : ""
      }`}
    >
      <p className="text-[10px] text-gray-400 sm:text-xs">{label}</p>
      <h2 className="mt-1 text-xl font-bold tabular-nums text-white sm:mt-1.5 sm:text-2xl">{value}</h2>
    </div>
  );
}

function QuickAction({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-white/5 p-2 text-center backdrop-blur-xl transition duration-300 hover:scale-[1.02] hover:border-emerald-500/35 active:scale-[0.98] sm:min-h-[52px] sm:p-2.5"
    >
      <div className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 text-sm font-black text-gray-950 shadow-[0_2px_14px_rgba(16,185,129,0.35)]">
        {icon}
      </div>
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-gray-400">{label}</p>
    </button>
  );
}
