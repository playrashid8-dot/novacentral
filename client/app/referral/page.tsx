"use client";

import { getUser } from "../../lib/auth";
import { useState } from "react";
import { motion } from "framer-motion";

export default function Referral() {
  const user = getUser();

  const [copied, setCopied] = useState(false);

  const link = `https://yourdomain.com/signup?ref=${user?._id}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen max-w-[420px] mx-auto px-4 py-6 text-white relative bg-[#040406]">

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
          ${Number(user?.referralEarnings || 0).toFixed(2)}
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

        <Stat title="Team Size" value={user?.teamCount || 0} />
        <Stat title="Active Users" value={user?.activeTeam || 0} />
        <Stat title="Level Income" value={`$${user?.levelIncome || 0}`} />
        <Stat title="Direct Bonus" value={`$${user?.directBonus || 0}`} />

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