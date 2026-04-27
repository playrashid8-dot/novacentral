"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import API, { getApiErrorMessage } from "../../lib/api";
import ProtectedRoute from "../../components/ProtectedRoute";
import AppToast from "../../components/AppToast";
import { fetchCurrentUser } from "../../lib/session";
import { fetchHybridSummary } from "../../lib/hybrid";

export default function Referral() {
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [user, setUser]: any = useState(null);
  const [hybrid, setHybrid] = useState<any>(null);

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
        setStats(res.data?.stats || null);
        setHybrid(hybridData);
      } catch (err: any) {
        showToast(getApiErrorMessage(err, "Failed to load referral stats ❌"));
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

  return (
    <ProtectedRoute>
    <div className="min-h-screen max-w-[420px] mx-auto px-4 py-6 text-white relative bg-[#040406]">
      <AppToast message={toast} />

      {/* 🌌 BACKGROUND */}
      <div className="absolute w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[150px] top-[-150px] left-[-150px]" />
      <div className="absolute w-[500px] h-[500px] bg-indigo-600 opacity-20 blur-[150px] bottom-[-150px] right-[-150px]" />

      {/* HEADER */}
      <h1 className="text-xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
        Referral Program 👥
      </h1>

      {/* 💎 EARNINGS CARD */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 p-5 rounded-2xl border border-white/10 mb-5 text-center"
      >
        <p className="text-xs text-gray-400">Total Referral Earnings</p>
        <h2 className="text-3xl font-bold text-green-400 mt-1">
          ${Number(hybrid?.referralEarnings || stats?.referralEarnings || user?.referralEarnings || 0).toFixed(2)}
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

          <button
            onClick={copyLink}
            className="mt-3 w-full bg-gradient-to-r from-purple-500 to-indigo-500 p-2 rounded-xl text-sm font-semibold"
          >
            {copied ? "Copied ✅" : "Copy Link"}
          </button>

        </div>
      </div>

      {/* 📊 STATS */}
      <div className="grid grid-cols-2 gap-3">

        <Stat title="Team Size" value={hybrid?.teamCount || stats?.teamCount || 0} />
        <Stat title="Direct Referrals" value={hybrid?.directCount || stats?.directCount || 0} />
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