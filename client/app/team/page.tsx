"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getApiErrorMessage } from "../../lib/api";
import { logout } from "../../lib/auth";
import { fetchCurrentUser } from "../../lib/session";
import { claimHybridSalary, fetchHybridSummary } from "../../lib/hybrid";
import AppToast from "../../components/AppToast";
import ProtectedRoute from "../../components/ProtectedRoute";
import GradientButton from "../../components/GradientButton";
import ProgressBar from "../../components/ProgressBar";
import PageWrapper from "../../components/PageWrapper";

export default function TeamPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [hybrid, setHybrid] = useState<any>(null);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  useEffect(() => {
    loadUser(false);
    const onFocus = () => loadUser(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
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
      setHybrid(hybridData);
    } catch (err: any) {
      if (!silent) showToast(getApiErrorMessage(err, "Session expired 🔒"));
      logout();
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const referralCode = String(user?.referralCode ?? "").trim();
  const referralIncome = Number(hybrid?.referralEarnings || 0);
  const su = hybrid?.salaryUi;
  const directCount = Number(su?.directCount ?? hybrid?.directCount ?? 0);
  const teamCount = Number(su?.teamCount ?? hybrid?.teamCount ?? 0);
  const claimableStage = Number(su?.claimableStage ?? hybrid?.salaryStage ?? 0);
  const claimableAmount = Number(su?.claimableAmount ?? 0);
  const nextDirectNeed = Number(su?.nextDirectNeed ?? hybrid?.salaryRules?.[0]?.directCount ?? 3);
  const nextTeamNeed = Number(su?.nextTeamNeed ?? hybrid?.salaryRules?.[0]?.teamCount ?? 10);
  const nextReward = su?.nextReward != null ? Number(su.nextReward) : null;
  const nextStageNum = su?.nextStage != null ? Number(su.nextStage) : null;
  const salaryClaimable = claimableStage > 0;

  const hasNoTeam = directCount === 0 && teamCount === 0;

  const handleClaimSalary = async () => {
    if (salaryLoading) return;
    try {
      setSalaryLoading(true);
      const result = await claimHybridSalary();
      const salMsg =
        typeof (result as { msg?: string })?.msg === "string" &&
        (result as { msg?: string }).msg?.trim()
          ? String((result as { msg?: string }).msg).trim()
          : "";
      showToast(
        salMsg ||
          `Salary claimed: $${Number(
            (result as { amount?: number })?.amount || claimableAmount || 0,
          ).toFixed(2)}`,
      );
      await loadUser(true);
    } catch (err: any) {
      showToast(getApiErrorMessage(err, "Failed to claim salary ❌"));
    } finally {
      setSalaryLoading(false);
    }
  };

  const copyCode = async () => {
    if (!referralCode) return;
    await navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ProtectedRoute>
      <PageWrapper loading={loading} data={user?._id} useSkeletonLoading emptyText="No data available">
        <div className="relative w-full max-w-full overflow-x-hidden pb-3 text-white">
          <AppToast message={toast} />

          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-300/80">
              Network
            </p>
            <h1 className="mt-0.5 bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-xl font-black text-transparent sm:text-2xl">
              👥 Team
            </h1>
          </motion.div>

          {hasNoTeam && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 rounded-lg border border-indigo-400/20 bg-indigo-500/10 p-3 text-center ring-1 ring-indigo-400/10"
            >
              <p className="text-sm font-semibold text-indigo-100">Invite users to unlock rewards</p>
              <p className="mt-1 text-[11px] text-indigo-200/70">
                Share your referral code to grow direct and team volume.
              </p>
            </motion.div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div className="rounded-lg border border-white/[0.07] bg-[#111827]/90 p-3 shadow-md ring-1 ring-white/[0.04]">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                Referral code
              </p>
              <p className="mt-2 break-all font-mono text-sm font-bold text-white">
                {referralCode || "—"}
              </p>
              <button
                type="button"
                onClick={copyCode}
                disabled={!referralCode}
                className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.06] py-1.5 text-[10px] font-semibold text-gray-200 disabled:opacity-40"
              >
                {copied ? "Copied" : "Copy code"}
              </button>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-[#111827]/90 p-3 shadow-md ring-1 ring-white/[0.04]">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                Total referral income
              </p>
              <p className="mt-2 text-xl font-black tabular-nums text-emerald-300">
                ${referralIncome.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-[#111827]/90 p-3 shadow-md ring-1 ring-white/[0.04]">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                Direct members
              </p>
              <p className="mt-2 text-xl font-black tabular-nums">{directCount}</p>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-[#111827]/90 p-3 shadow-md ring-1 ring-white/[0.04]">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                Team members
              </p>
              <p className="mt-2 text-xl font-black tabular-nums">{teamCount}</p>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 ring-1 ring-white/[0.04]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-gray-500">
              Referral overview
            </p>
            <div className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-gray-400">Referral Income</span>
                <span className="font-bold tabular-nums text-white">${referralIncome.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-400">Direct</span>
                <span className="font-bold tabular-nums text-white">{directCount}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-400">Team</span>
                <span className="font-bold tabular-nums text-white">{teamCount}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 ring-1 ring-white/[0.04]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
              Team progress
            </p>
            <ProgressBar
              label="Direct progress (next milestone)"
              value={directCount}
              max={Math.max(nextDirectNeed, 1)}
              hint={`${directCount} / ${nextDirectNeed}`}
            />
            <ProgressBar
              label="Team progress (next milestone)"
              value={teamCount}
              max={Math.max(nextTeamNeed, 1)}
              hint={`${teamCount} / ${nextTeamNeed}`}
            />
          </div>

          <div className="mt-3 rounded-lg border border-yellow-400/25 bg-[#08080d]/90 p-3 shadow-md ring-1 ring-yellow-400/10 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[9px] uppercase tracking-[0.22em] text-yellow-200/75">Team Milestone</p>
                <h3 className="mt-0.5 text-base font-black text-white">Salary Rewards</h3>
              </div>
              <span className="shrink-0 rounded-full border border-yellow-300/20 bg-yellow-400/10 px-2 py-0.5 text-[9px] font-semibold text-yellow-100">
                {salaryClaimable ? `Claim stage ${claimableStage}` : "Build team"}
              </span>
            </div>

            <p className="mt-2 text-[11px] text-gray-400">
              {nextStageNum != null ? (
                <>
                  Next milestone: stage {nextStageNum}
                  {nextReward != null ? ` · up to $${nextReward.toFixed(0)}` : ""}
                </>
              ) : (
                "All salary milestones claimed."
              )}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniMetric title="Ready stage" value={salaryClaimable ? claimableStage : "—"} raw />
              <MiniMetric
                title="Payout if claimed"
                value={salaryClaimable ? claimableAmount : "—"}
                raw={!salaryClaimable}
              />
            </div>

            <GradientButton
              onClick={handleClaimSalary}
              loading={salaryLoading}
              disabled={!salaryClaimable || salaryLoading}
              className="mt-3"
            >
              {salaryLoading ? "Claiming..." : "Claim Salary Reward"}
            </GradientButton>
          </div>
        </div>
      </PageWrapper>
    </ProtectedRoute>
  );
}

function MiniMetric({ title, value, raw = false }: any) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.04] p-2.5 ring-1 ring-white/[0.04]">
      <p className="text-[9px] text-gray-500">{title}</p>
      <p className="mt-0.5 text-sm font-bold text-indigo-100 tabular-nums">
        {raw ? value : `$${Number(value || 0).toFixed(2)}`}
      </p>
    </div>
  );
}
