"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import API, { getApiErrorMessage, normalize } from "../../lib/api";
import ProtectedRoute from "../../components/ProtectedRoute";
import PageWrapper from "../../components/PageWrapper";
import AppToast from "../../components/AppToast";
import { fetchCurrentUser } from "../../lib/session";
import { claimHybridSalary, fetchHybridSummary } from "../../lib/hybrid";
import GradientButton from "../../components/GradientButton";

/** Mirrors server `SALARY_RULES` (hybrid/utils/constants.js) */
const SALARY_UI_STAGES = [
  { level: 1, direct: 3, team: 10, reward: 30 },
  { level: 2, direct: 6, team: 20, reward: 80 },
  { level: 3, direct: 12, team: 35, reward: 250 },
  { level: 4, direct: 18, team: 45, reward: 500 },
] as const;

export default function Referral() {
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [user, setUser]: any = useState(null);
  const [hybrid, setHybrid] = useState<any>(null);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [fresh, res, hybridData] = await Promise.all([
          fetchCurrentUser(),
          API.get("/user/referral-stats"),
          fetchHybridSummary().catch(() => null),
        ]);
        if (fresh) setUser(fresh);
        const response = normalize(res.data);
        const payload =
          response.data && typeof response.data === "object" && Object.keys(response.data).length
            ? response.data
            : null;
        setStats(payload);
        setHybrid(hybridData);
      } catch (err: any) {
        showToast(getApiErrorMessage(err, "Failed to load referral stats ❌"));
      } finally {
        setPageLoading(false);
      }
    };
    loadStats();
  }, []);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const link = `${origin}/signup?ref=${stats?.referralCode || user?.referralCode || ""}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const su = hybrid?.salaryUi;
  const direct = Number(su?.directCount ?? hybrid?.directCount ?? stats?.directCount ?? 0);
  const team = Number(su?.teamCount ?? hybrid?.teamCount ?? stats?.teamCount ?? 0);
  const backendClaimableStage = Number(su?.claimableStage ?? hybrid?.salaryStage ?? 0);

  const claimedStages = useMemo(
    () => (su?.claimedSalaryStages ?? []).map(Number),
    [su?.claimedSalaryStages],
  );

  const nextStage =
    SALARY_UI_STAGES.find((s) => !claimedStages.includes(s.level)) ?? null;

  const handleClaimStage = async (stageLevel: number) => {
    const canPay =
      backendClaimableStage === stageLevel &&
      backendClaimableStage > 0 &&
      !salaryLoading;
    if (!canPay) return;

    try {
      setSalaryLoading(true);
      const result = (await claimHybridSalary()) as {
        msg?: string;
        amount?: number;
        stage?: number;
      } | null;
      const claimed = Number(result?.stage ?? stageLevel);
      const salMsg =
        typeof result?.msg === "string" && result.msg.trim()
          ? result.msg.trim()
          : "";
      showToast(salMsg || `Stage ${claimed} claimed · $${Number(result?.amount ?? 0).toFixed(2)} USDT`);
      const hybridData = await fetchHybridSummary().catch(() => null);
      setHybrid(hybridData);
    } catch (err: any) {
      showToast(getApiErrorMessage(err, "Failed to claim salary reward"));
    } finally {
      setSalaryLoading(false);
    }
  };

  const salaryStagesUi = useMemo(
    () =>
      SALARY_UI_STAGES.map((stage) => {
        const isUnlocked = direct >= stage.direct && team >= stage.team;
        const isClaimed = claimedStages.includes(stage.level);
        const isNext = backendClaimableStage === stage.level;

        return {
          ...stage,
          isUnlocked,
          isClaimed,
          isNext,
        };
      }),
    [direct, team, claimedStages, backendClaimableStage],
  );

  const salaryClaimable = backendClaimableStage > 0;

  return (
    <ProtectedRoute>
    <PageWrapper loading={pageLoading} skipEmpty>
    <div className="min-h-screen max-w-[420px] mx-auto px-4 py-6 pb-10 text-white relative bg-[#040406] overflow-x-hidden w-full">
      <AppToast message={toast} />

      {/* 🌌 BACKGROUND */}
      <div className="absolute w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[150px] top-[-150px] left-[-150px]" />
      <div className="absolute w-[500px] h-[500px] bg-indigo-600 opacity-20 blur-[150px] bottom-[-150px] right-[-150px]" />

      {/* HEADER */}
      <h1 className="text-xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
        HybridEarn Referral
      </h1>

      {/* 💎 EARNINGS CARD */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 p-5 rounded-2xl border border-white/10 mb-5 text-center"
      >
        <p className="text-xs text-gray-400">Total Referral Earnings</p>
        <h2 className="text-3xl font-bold text-green-400 mt-1">
          ${Number(hybrid?.referralEarnings ?? stats?.referralEarnings ?? user?.referralEarnings ?? 0).toFixed(2)}
        </h2>
      </motion.div>

      {/* 🔗 LINK CARD */}
      <div className="p-[1px] rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 mb-5">
        <div className="bg-[#0b0b0f] p-4 rounded-2xl">

          <p className="text-sm text-gray-400 mb-2">
            Your Referral Link
          </p>

          <div className="bg-black/40 p-3 rounded-xl border border-white/10 text-xs break-all">
            {link}
          </div>

          <GradientButton
            onClick={copyLink}
            className="mt-3 w-full rounded-xl p-3"
          >
            {copied ? "Copied ✅" : "Copy Link"}
          </GradientButton>

        </div>
      </div>

      {/* 📊 STATS */}
      <div className="grid grid-cols-2 gap-3">

        <Stat title="Team Count" value={team} />
        <Stat title="Direct Count" value={direct} />
        <Stat title="Team Volume" value={`$${Number(stats?.teamVolume || 0).toFixed(2)}`} />
        <Stat title="Referral Code" value={stats?.referralCode || user?.referralCode || "-"} />

      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <Stat title="Hybrid Level" value={hybrid?.level || 0} />
        <Stat
          title="ROI Rate"
          value={`${(Number(hybrid?.roiRate || 0) * 100).toFixed(2)}%`}
        />
      </div>

      <div className="mt-5 p-[1px] rounded-2xl bg-gradient-to-r from-yellow-400/70 via-purple-500/70 to-cyan-400/70">
        <div className="rounded-2xl bg-[#08080d]/95 p-4 backdrop-blur-2xl">
          <p className="text-sm font-semibold text-white">Referral income</p>
          <p className="mt-2 text-xs leading-relaxed text-gray-400">
            Referral rewards follow your live HybridEarn balances and rules. Figures on this page come from your account data only.
          </p>
        </div>
      </div>

      <div className="mt-5 p-[1px] rounded-2xl bg-gradient-to-r from-yellow-300/80 via-purple-500/60 to-cyan-400/70">
        <div className="rounded-2xl bg-[#08080d]/95 p-4 backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-yellow-200/80">Salary Rewards (HybridEarn)</p>
              <h3 className="mt-1 text-lg font-black text-white">Stage milestones</h3>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-[10px] font-bold ${
                salaryClaimable
                  ? "border-green-300/30 bg-green-400/10 text-green-200"
                  : "border-yellow-300/20 bg-yellow-400/10 text-yellow-200"
              }`}
            >
              {salaryClaimable ? "Reward ready (server)" : "In progress"}
            </span>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Direct = your direct referrals only. Team = total network size. Thresholds match the server; claim becomes
            available when you meet the next unclaimed stage and the server marks it ready.
          </p>
          {nextStage && (
            <div className="mt-4">
              <p className="text-gray-400 text-xs">Next Stage Progress</p>
              <div className="mt-1.5 w-full bg-gray-700 h-2 rounded-full">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-[width] duration-300"
                  style={{
                    width: `${Math.min((team / nextStage.team) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5 tabular-nums">
                Team {team}/{nextStage.team}
                {nextStage.direct > 0 ? ` · Direct ${direct}/${nextStage.direct}` : ""}
              </p>
            </div>
          )}
          <div className="mt-4 space-y-3">
            {salaryStagesUi.map((stage) => {
              const borderClass = stage.isClaimed
                ? "border-blue-400/80 bg-blue-500/10"
                : stage.isUnlocked && stage.isNext
                  ? "border-emerald-400/70 bg-emerald-500/10"
                  : "border-white/10 bg-white/5";
              const btnDisabled =
                !stage.isUnlocked || stage.isClaimed || !stage.isNext || salaryLoading;

              return (
                <div
                  key={stage.level}
                  className={`rounded-2xl border p-4 ${borderClass}`}
                >
                  <h2 className="text-base font-bold text-white">Stage {stage.level}</h2>
                  <p className="text-gray-400 text-xs mt-1">
                    Need direct {stage.direct} · team {stage.team}
                  </p>
                  <p className="text-emerald-400 font-bold mt-2">${stage.reward} USDT</p>
                  <div className="text-xs text-gray-400 mt-2 tabular-nums">
                    Direct: {direct}/{stage.direct} • Team: {team}/{stage.team}
                  </div>
                  <button
                    type="button"
                    disabled={btnDisabled}
                    onClick={() => handleClaimStage(stage.level)}
                    className={`mt-3 w-full py-2 rounded-xl text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      stage.isClaimed
                        ? "bg-blue-500"
                        : stage.isUnlocked && stage.isNext
                          ? "bg-emerald-500 hover:bg-emerald-400"
                          : "bg-gray-600"
                    }`}
                  >
                    {stage.isClaimed
                      ? "Claimed"
                      : stage.isUnlocked
                        ? stage.isNext
                          ? salaryLoading
                            ? "Claiming…"
                            : "Claim Salary"
                          : "Waiting"
                        : "Locked"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 📢 INFO */}
      <div className="mt-5 bg-white/5 p-4 rounded-2xl border border-white/10 text-sm">

        <p className="text-yellow-400 font-semibold mb-2">
          💡 How it works
        </p>

        <ul className="space-y-1 text-gray-400 text-xs">
          <li>• Share your referral link</li>
          <li>• Earn commission from deposits</li>
          <li>• Get team bonuses daily</li>
          <li>• Build passive income network</li>
        </ul>

      </div>

    </div>
    </PageWrapper>
    </ProtectedRoute>
  );
}

/* 🔹 STAT */
function Stat({ title, value }: any) {
  return (
    <div className="bg-white/5 p-3 rounded-xl border border-white/10 text-center">
      <p className="text-[10px] text-gray-400">{title}</p>
      <h4 className="font-bold text-sm text-purple-400 mt-1">
        {value}
      </h4>
    </div>
  );
}
