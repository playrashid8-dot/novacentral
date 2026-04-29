"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import ProtectedRoute from "../../../components/ProtectedRoute";
import PageWrapper from "../../../components/PageWrapper";
import AppToast from "../../../components/AppToast";
import { fetchCurrentUser } from "../../../lib/session";
import { logout } from "../../../lib/auth";
import { claimHybridSalary, fetchSalaryProgress } from "../../../lib/hybrid";
import { getApiErrorMessage } from "../../../lib/api";

type RuleRow = {
  stage: number;
  directCount: number;
  teamCount: number;
  amount: number;
};

type HistoryRow = { stage?: number; amount?: number; claimedAt?: string | null };

export default function TeamSalaryPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [salaryPayload, setSalaryPayload] = useState<any>(null);
  const [claiming, setClaiming] = useState<number | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchCurrentUser();
      if (!data) throw new Error("No user data");
      setUser(data);
      const sal = await fetchSalaryProgress();
      setSalaryPayload(sal);
    } catch (err: any) {
      showToast(getApiErrorMessage(err, "Session expired 🔒"));
      logout();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const direct = Number(salaryPayload?.direct ?? 0);
  const team = Number(salaryPayload?.team ?? 0);
  const claimableStage = Number(salaryPayload?.claimableStage ?? 0);
  const stages: RuleRow[] = useMemo(() => {
    const r = salaryPayload?.rules;
    return Array.isArray(r) ? r : [];
  }, [salaryPayload]);

  const history: HistoryRow[] = useMemo(
    () =>
      [...(salaryPayload?.salaryHistory ?? [])].sort((a: HistoryRow, b: HistoryRow) => {
        const ta = new Date(a.claimedAt || 0).getTime();
        const tb = new Date(b.claimedAt || 0).getTime();
        return tb - ta;
      }),
    [salaryPayload]
  );

  const handleClaim = async (stageRule: RuleRow) => {
    const target = Number(stageRule.stage);
    if (claimableStage !== target) {
      showToast("This stage cannot be claimed yet.");
      return;
    }
    if (direct < Number(stageRule.directCount) || team < Number(stageRule.teamCount)) {
      showToast("Requirements not met for this stage.");
      return;
    }
    try {
      setClaiming(target);
      const res = await claimHybridSalary();
      if (!res || typeof res.stage !== "number") {
        throw new Error("Unexpected response");
      }
      showToast(`Stage ${res.stage} claimed (+$${Number(res.amount ?? 0).toFixed(2)})`);
      await load();
    } catch (err: any) {
      showToast(err?.message || err?.msg || "Claim failed");
    } finally {
      setClaiming(null);
    }
  };

  return (
    <ProtectedRoute>
      <PageWrapper loading={loading} data={user?._id} useSkeletonLoading emptyText="No data available">
        <div className="relative w-full max-w-full overflow-x-hidden pb-10 text-white">
          <AppToast message={toast} />

          <motion.header
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <Link
                href="/team"
                className="mb-2 inline-flex text-[11px] font-semibold uppercase tracking-wider text-violet-300/90 hover:text-violet-200"
              >
                ← Back to Team
              </Link>
              <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">Team salary</h1>
              <p className="mt-2 text-[11px] text-gray-500">
                Milestones use fresh recruits since your last claim. Same rules as HybridEarn rewards.
              </p>
            </div>
          </motion.header>

          <div className="mb-8 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 ring-1 ring-white/[0.05]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">Your counts (fresh)</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-black/30 px-4 py-3 ring-1 ring-white/[0.06]">
                <p className="text-[10px] uppercase text-gray-500">Direct</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-emerald-300">{direct}</p>
              </div>
              <div className="rounded-xl bg-black/30 px-4 py-3 ring-1 ring-white/[0.06]">
                <p className="text-[10px] uppercase text-gray-500">Team</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-sky-300">{team}</p>
              </div>
            </div>
          </div>

          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {stages.map((rule) => {
              const unlocked =
                direct >= Number(rule.directCount) && team >= Number(rule.teamCount);
              const currentStageMarker = Number(claimableStage);
              const isCurrent =
                unlocked && currentStageMarker !== 0 && Number(rule.stage) === currentStageMarker;

              return (
                <div
                  key={rule.stage}
                  className={`rounded-2xl border p-4 ${
                    unlocked
                      ? "border-emerald-400/60 bg-emerald-500/10"
                      : "border-white/[0.06] bg-white/[0.04]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-white">Stage {rule.stage}</h2>
                      <p className="mt-2 text-xs text-gray-400">
                        Direct: {direct}/{rule.directCount}
                      </p>
                      <p className="text-xs text-gray-400">
                        Team: {team}/{rule.teamCount}
                      </p>
                    </div>
                    <p className="text-xl font-black tabular-nums text-emerald-400">${rule.amount}</p>
                  </div>

                  <button
                    type="button"
                    disabled={!isCurrent || !unlocked || claiming === rule.stage}
                    className={`mt-4 w-full rounded-xl py-2.5 text-sm font-bold transition ${
                      unlocked && isCurrent && claiming !== rule.stage
                        ? "bg-emerald-600 text-white hover:bg-emerald-500"
                        : "cursor-not-allowed bg-white/[0.08] text-gray-400"
                    }`}
                    onClick={() => handleClaim(rule)}
                  >
                    {claiming === rule.stage
                      ? "Processing…"
                      : unlocked && isCurrent
                        ? "Claim"
                        : !unlocked
                          ? "Locked"
                          : "Not available"}
                  </button>
                </div>
              );
            })}
          </motion.section>

          {history.length > 0 ? (
            <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-10 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">History</p>
              <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4 ring-1 ring-white/[0.04]">
                {history.slice(0, 25).map((item, idx) => (
                  <div
                    key={`${item.stage}-${String(item.claimedAt ?? idx)}`}
                    className="flex justify-between border-b border-white/[0.04] py-3 text-sm last:border-b-0"
                  >
                    <span className="text-gray-300">Stage {item.stage}</span>
                    <span className="font-semibold tabular-nums text-emerald-300">
                      ${Number(item.amount ?? 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-500">
                Most recent payouts first. Showing up to the last {Math.min(history.length, 25)} entries.
              </p>
            </motion.section>
          ) : (
            <p className="mt-10 rounded-xl border border-dashed border-white/[0.1] px-4 py-6 text-center text-sm text-gray-500">
              No salary claims yet — unlock a stage above to earn your first payout.
            </p>
          )}
        </div>
      </PageWrapper>
    </ProtectedRoute>
  );
}
