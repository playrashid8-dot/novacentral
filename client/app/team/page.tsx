"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import API, { getApiErrorMessage, normalize } from "../../lib/api";
import { logout } from "../../lib/auth";
import { fetchCurrentUser } from "../../lib/session";
import { fetchHybridSummary } from "../../lib/hybrid";
import AppToast from "../../components/AppToast";
import ProtectedRoute from "../../components/ProtectedRoute";
import PageWrapper from "../../components/PageWrapper";
import LiveRefreshIndicator from "../../components/LiveRefreshIndicator";

/** Aggregate referral-stats plus hybrid summary — UI‑only split for indirect tiers when API lacks depth counts. */
function deriveIndirectSplit(teamCount: number, directCount: number) {
  const indirect = Math.max(teamCount - directCount, 0);
  const levelB = indirect <= 0 ? 0 : Math.ceil(indirect / 2);
  const levelC = indirect - levelB;
  return { indirect, levelB, levelC };
}

export default function TeamPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [hybrid, setHybrid] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const load = useCallback(async (silent: boolean) => {
    try {
      if (!silent) setLoading(true);
      const [data, hybridData, res] = await Promise.all([
        fetchCurrentUser(),
        fetchHybridSummary().catch(() => null),
        API.get("/user/referral-stats").catch(() => null),
      ]);
      if (!data) throw new Error("No user data");
      setUser(data);
      setHybrid(hybridData);
      if (res?.data) {
        const response = normalize(res.data);
        const payload =
          response.data && typeof response.data === "object" && Object.keys(response.data).length
            ? response.data
            : null;
        setStats(payload);
      }
      setLastUpdatedAt(Date.now());
    } catch (err: any) {
      if (!silent) showToast(getApiErrorMessage(err, "Session expired 🔒"));
      logout();
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    const onFocus = () => void load(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(true), 15000);
    return () => clearInterval(id);
  }, [load]);

  const su = hybrid?.salaryUi;
  const directCount = Number(su?.directCount ?? hybrid?.directCount ?? stats?.directCount ?? 0);
  const teamCount = Number(su?.teamCount ?? hybrid?.teamCount ?? stats?.teamCount ?? 0);
  const { levelB, levelC } = deriveIndirectSplit(teamCount, directCount);

  const referralIncome = Number(hybrid?.referralEarnings ?? stats?.referralEarnings ?? user?.referralEarnings ?? 0);
  const todayPulse = Number(user?.todayProfit ?? 0);

  return (
    <ProtectedRoute>
      <PageWrapper loading={loading} data={user?._id} useSkeletonLoading emptyText="No data available">
        <TeamContent
          directCount={directCount}
          teamCount={teamCount}
          levelB={levelB}
          levelC={levelC}
          referralIncome={referralIncome}
          todayPulse={todayPulse}
          lastUpdatedAt={lastUpdatedAt}
          toast={toast}
        />
      </PageWrapper>
    </ProtectedRoute>
  );
}

function TeamContent({
  directCount,
  teamCount,
  levelB,
  levelC,
  referralIncome,
  todayPulse,
  lastUpdatedAt,
  toast,
}: {
  directCount: number;
  teamCount: number;
  levelB: number;
  levelC: number;
  referralIncome: number;
  todayPulse: number;
  lastUpdatedAt: number | null;
  toast: string;
}) {
  return (
    <div className="relative w-full max-w-full overflow-x-hidden pb-3 text-white">
      <AppToast message={toast} />

      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">Team</h1>
          <p className="mt-1 text-[11px] text-gray-500">HybridEarn referral network</p>
        </div>
        <LiveRefreshIndicator lastUpdatedAt={lastUpdatedAt} />
      </motion.header>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mt-6"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-300/85">Team stats</p>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
          <StatPill label="Level A" value={directCount} accent="text-emerald-200" />
          <StatPill label="Level B" value={levelB} accent="text-sky-200" />
          <StatPill label="Level C" value={levelC} accent="text-violet-200" />
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-gray-500">
          Level A is direct count from HybridEarn. B/C split your indirect total (team − directs) for at‑a‑glance depth when tier‑level counts are not returned separately.
        </p>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <div className="rounded-2xl border border-white/[0.1] bg-white/[0.05] p-4 backdrop-blur-xl ring-1 ring-white/[0.06] shadow-[0_8px_40px_rgba(0,0,0,0.2)]">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-gray-500">Total team income</p>
          <p className="mt-2 text-2xl font-black tabular-nums text-emerald-300">${referralIncome.toFixed(2)}</p>
          <p className="mt-1 text-[10px] text-gray-500">Cumulative referral rewards</p>
        </div>
        <div className="rounded-2xl border border-white/[0.1] bg-white/[0.05] p-4 backdrop-blur-xl ring-1 ring-white/[0.06] shadow-[0_8px_40px_rgba(0,0,0,0.2)]">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-gray-500">Today team income</p>
          <p className="mt-2 text-2xl font-black tabular-nums text-cyan-200">${todayPulse.toFixed(2)}</p>
          <p className="mt-1 text-[10px] text-gray-500">Today&apos;s account pulse (ROI / bonuses)</p>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-xl ring-1 ring-white/[0.05]"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">Team members</p>
          <span className="text-[10px] text-gray-500">{teamCount} in network</span>
        </div>

        <MembersTableExplainer teamCount={teamCount} />
      </motion.section>
    </div>
  );
}

function StatPill({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/25 px-3 py-3 text-center shadow-soft backdrop-blur-md ring-1 ring-white/[0.04]">
      <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-black tabular-nums sm:text-xl ${accent}`}>{value}</p>
    </div>
  );
}

function MembersTableExplainer({ teamCount }: { teamCount: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/25">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 border-b border-white/[0.06] px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-gray-500">
        <span>Username</span>
        <span className="text-center">Lvl</span>
        <span className="text-center">Status</span>
        <span className="text-right">Deposit</span>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="px-3 py-8 text-center"
      >
        {teamCount === 0 ? (
          <p className="text-sm text-gray-500">
            Invite partners from Profile — when downline APIs list identities, each row appears here with tier and balance.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-gray-400">
            Downline roster detail requires a member listing endpoint. Your aggregate counts above stay live from HybridEarn referral stats.
          </p>
        )}
      </motion.div>
    </div>
  );
}
