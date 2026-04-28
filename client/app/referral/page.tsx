"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import API, { getApiErrorMessage, normalize } from "../../lib/api";
import ProtectedRoute from "../../components/ProtectedRoute";
import AppToast from "../../components/AppToast";
import { fetchCurrentUser } from "../../lib/session";
import { claimHybridSalary, fetchHybridSummary } from "../../lib/hybrid";
import GradientButton from "../../components/GradientButton";
import ProgressBar from "../../components/ProgressBar";
import Loader from "../../components/Loader";

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

  const directCount = Number(hybrid?.salaryDirectCount || hybrid?.directCount || stats?.directCount || 0);
  const teamCount = Number(hybrid?.salaryTeamCount || hybrid?.teamCount || stats?.teamCount || 0);
  const stage1 = hybrid?.salaryRules?.[0];
  const needDirect = stage1 != null ? Number(stage1.directCount) : NaN;
  const needTeam = stage1 != null ? Number(stage1.teamCount) : NaN;
  const needDirectBar = Number.isFinite(needDirect) && needDirect > 0 ? needDirect : 1;
  const needTeamBar = Number.isFinite(needTeam) && needTeam > 0 ? needTeam : 1;
  const salaryComplete =
    stage1 != null &&
    Number.isFinite(needDirect) &&
    Number.isFinite(needTeam) &&
    directCount >= needDirect &&
    teamCount >= needTeam;

  const claimSalary = async () => {
    if (!salaryComplete || salaryLoading) return;

    try {
      setSalaryLoading(true);
      const result = await claimHybridSalary();
      showToast(`Salary claimed: $${Number(result?.amount ?? 0).toFixed(2)}`);
      const hybridData = await fetchHybridSummary().catch(() => null);
      setHybrid(hybridData);
    } catch (err: any) {
      showToast(getApiErrorMessage(err, "Failed to claim salary reward"));
    } finally {
      setSalaryLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <ProtectedRoute>
        <Loader />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
    <div className="min-h-screen max-w-[420px] mx-auto px-4 py-6 pb-10 text-white relative bg-[#040406] overflow-x-hidden">
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

        <Stat title="Team Count" value={hybrid?.teamCount || stats?.teamCount || 0} />
        <Stat title="Direct Count" value={hybrid?.directCount || stats?.directCount || 0} />
        <Stat title="Team Volume" value={`$${Number(stats?.teamVolume || 0).toFixed(2)}`} />
        <Stat title="Referral Code" value={stats?.referralCode || user?.referralCode || "-"} />

      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <Stat title="Hybrid Level" value={hybrid?.level || 0} />
        <Stat
          title="ROI Rate"
          value={`${(Number(hybrid?.roiRate || 0) * 100).toFixed(2)}%`}
        />
        <Stat title="Salary Direct" value={hybrid?.salaryDirectCount || 0} />
        <Stat title="Salary Team" value={hybrid?.salaryTeamCount || 0} />
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-2xl">
        <p className="text-sm font-semibold text-white">Live Progress</p>
        <div className="mt-3 space-y-3">
          <ProgressBar
            label="Direct"
            value={directCount}
            max={needDirectBar}
            hint={
              stage1
                ? `Direct: ${directCount} / ${needDirect}`
                : `Direct: ${directCount} (loading rules…)`
            }
          />
          <ProgressBar
            label="Team"
            value={teamCount}
            max={needTeamBar}
            hint={
              stage1 ? `Team: ${teamCount} / ${needTeam}` : `Team: ${teamCount} (loading rules…)`
            }
          />
        </div>
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
              <p className="text-[10px] uppercase tracking-[0.24em] text-yellow-200/80">Salary Rewards</p>
              <h3 className="mt-1 text-lg font-black text-white">Stage 1</h3>
            </div>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-bold ${salaryComplete ? "border-green-300/30 bg-green-400/10 text-green-200" : "border-yellow-300/20 bg-yellow-400/10 text-yellow-200"}`}>
              {salaryComplete ? "Complete" : "In Progress"}
            </span>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            {stage1
              ? `Requirement (stage 1): ${needDirect} direct + ${needTeam} team`
              : "Loading salary rules from HybridEarn…"}
          </p>
          <div className="mt-4 space-y-3">
            <ProgressBar label="Direct" value={directCount} max={needDirectBar} />
            <ProgressBar label="Team" value={teamCount} max={needTeamBar} />
          </div>
          <GradientButton
            onClick={claimSalary}
            disabled={!salaryComplete || salaryLoading}
            loading={salaryLoading}
            className="mt-4"
          >
            {salaryLoading ? "Claiming..." : "Claim Salary Reward"}
          </GradientButton>
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
