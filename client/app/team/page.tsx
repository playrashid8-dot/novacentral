"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import API, { getApiErrorMessage, normalize } from "../../lib/api";
import { logout } from "../../lib/auth";
import { fetchCurrentUser } from "../../lib/session";
import AppToast from "../../components/AppToast";
import ProtectedRoute from "../../components/ProtectedRoute";
import PageWrapper from "../../components/PageWrapper";
import LiveRefreshIndicator from "../../components/LiveRefreshIndicator";

type ReferralStatsPayload = {
    directCount?: number;
    teamCount?: number;
    referralEarnings?: number;
    referralCode?: string;
    teamVolume?: number;
};

export default function TeamPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [stats, setStats] = useState<ReferralStatsPayload | null>(null);
  const [referralStatsReady, setReferralStatsReady] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const load = useCallback(async (silent: boolean) => {
    try {
      if (!silent) setLoading(true);
      const [data, res] = await Promise.all([
        fetchCurrentUser(),
        API.get("/user/referral-stats").catch(() => null),
      ]);
      if (!data) throw new Error("No user data");
      setUser(data);
      if (res?.data) {
        const response = normalize(res.data);
        const payload =
          response.data && typeof response.data === "object" && Object.keys(response.data).length
            ? response.data
            : null;
        setStats(payload as ReferralStatsPayload);
      } else {
        setStats(null);
      }
      setLastUpdatedAt(Date.now());
    } catch (err: any) {
      if (!silent) showToast(getApiErrorMessage(err, "Session expired 🔒"));
      logout();
    } finally {
      setReferralStatsReady(true);
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
    return () => window.clearInterval(id);
  }, [load]);

  const directCount = Number(stats?.directCount ?? 0);
  const teamCount = Number(stats?.teamCount ?? 0);
  const referralIncome = Number(stats?.referralEarnings ?? 0);

  return (
    <ProtectedRoute>
      <PageWrapper loading={loading} data={user?._id} useSkeletonLoading emptyText="No data available">
        <TeamContent
          directCount={directCount}
          teamCount={teamCount}
          referralIncome={referralIncome}
          referralStatsReady={referralStatsReady}
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
  referralIncome,
  referralStatsReady,
  lastUpdatedAt,
  toast,
}: {
  directCount: number;
  teamCount: number;
  referralIncome: number;
  referralStatsReady: boolean;
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
          <p className="mt-1 text-[11px] text-gray-500">Referral overview</p>
        </div>
        <LiveRefreshIndicator lastUpdatedAt={lastUpdatedAt} />
      </motion.header>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mt-6"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-300/85">Stats</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          <StatPill label="Direct team (A)" value={referralStatsReady ? directCount : "—"} accent="text-emerald-200" />
          <StatPill label="Total team" value={referralStatsReady ? teamCount : "—"} accent="text-sky-200" />
          <StatPill
            label="Total team income"
            value={referralStatsReady ? `$${referralIncome.toFixed(2)}` : "—"}
            accent="text-violet-200"
            isCurrency
          />
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-gray-500">
          Data based on real referral stats
        </p>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-xl ring-1 ring-white/[0.05]"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">Members</p>
          <span className="text-[10px] text-gray-500">
            {referralStatsReady ? `${teamCount} in network` : "—"}
          </span>
        </div>

        <MembersMessage teamCount={teamCount} referralStatsReady={referralStatsReady} />
      </motion.section>
    </div>
  );
}

function StatPill({
  label,
  value,
  accent,
  isCurrency,
}: {
  label: string;
  value: number | string;
  accent: string;
  isCurrency?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/25 px-3 py-3 text-center shadow-soft backdrop-blur-md ring-1 ring-white/[0.04]">
      <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</p>
      <p
        className={`mt-1 font-black tabular-nums sm:text-xl ${accent} ${isCurrency ? "text-base sm:text-lg" : "text-lg"}`}
      >
        {value}
      </p>
    </div>
  );
}

function MembersMessage({ teamCount, referralStatsReady }: { teamCount: number; referralStatsReady: boolean }) {
  if (!referralStatsReady) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-8 text-center">
        <p className="text-sm text-gray-500">Loading team information…</p>
      </div>
    );
  }

  if (teamCount === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-8 text-center">
        <p className="text-sm font-medium text-gray-300">No team members yet — share your referral link</p>
        <p className="mt-2 text-[11px] text-gray-500">Use My referral link on Profile to invite partners.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-8 text-center">
      <p className="text-sm text-gray-400">Team member data not available</p>
      <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
        Individual usernames and balances are not listed by the app. Totals above reflect your referral stats.
      </p>
    </div>
  );
}
