"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { getUser } from "../../lib/auth";

export default function VIP() {
  const router = useRouter();
  const user = getUser();

  const vipLevels = [
    {
      name: "VIP 1",
      min: 100,
      bonus: "5% Deposit Bonus",
      roi: "+0.2% ROI",
      color: "from-purple-500 to-indigo-500",
    },
    {
      name: "VIP 2",
      min: 500,
      bonus: "10% Deposit Bonus",
      roi: "+0.5% ROI",
      color: "from-blue-500 to-cyan-500",
    },
    {
      name: "VIP 3",
      min: 1000,
      bonus: "15% Deposit Bonus",
      roi: "+1% ROI",
      color: "from-yellow-500 to-orange-500",
    },
  ];

  return (
    <div className="min-h-screen max-w-[420px] mx-auto px-4 py-6 text-white relative bg-[#040406]">

      {/* 🌌 BACKGROUND */}
      <div className="absolute w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[150px] top-[-150px] left-[-150px]" />
      <div className="absolute w-[500px] h-[500px] bg-indigo-600 opacity-20 blur-[150px] bottom-[-150px] right-[-150px]" />

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 relative z-10">
        <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
          VIP Membership 👑
        </h1>

        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-purple-400"
        >
          Back
        </button>
      </div>

      {/* CURRENT STATUS */}
      <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center mb-6">
        <p className="text-xs text-gray-400">Your VIP Level</p>
        <h2 className="text-xl font-bold text-purple-400 mt-1">
          {user?.vipLevel || "Basic"}
        </h2>

        <p className="text-xs text-gray-500 mt-1">
          Total Invested: ${Number(user?.totalInvested || 0).toFixed(2)}
        </p>
      </div>

      {/* VIP CARDS */}
      <div className="space-y-4 relative z-10">

        {vipLevels.map((vip, i) => {
          const unlocked = (user?.totalInvested || 0) >= vip.min;

          return (
            <motion.div
              key={i}
              whileHover={{ scale: 1.03 }}
              className={`p-[1px] rounded-2xl bg-gradient-to-r ${vip.color}`}
            >
              <div className="bg-[#0b0b0f] p-5 rounded-2xl">

                <div className="flex justify-between items-center">
                  <h2 className="font-bold text-lg">{vip.name}</h2>

                  {unlocked ? (
                    <span className="text-xs text-green-400">Unlocked ✅</span>
                  ) : (
                    <span className="text-xs text-gray-400">Locked 🔒</span>
                  )}
                </div>

                <p className="text-xs text-gray-400 mt-2">
                  Required Investment: ${vip.min}
                </p>

                <p className="text-sm text-green-400 mt-2">
                  🎁 {vip.bonus}
                </p>

                <p className="text-sm text-purple-400">
                  📈 {vip.roi}
                </p>

                {!unlocked && (
                  <button
                    onClick={() => router.push("/deposit")}
                    className="mt-4 w-full bg-gradient-to-r from-purple-500 to-indigo-500 p-2 rounded-xl text-sm font-semibold"
                  >
                    Upgrade 🚀
                  </button>
                )}

              </div>
            </motion.div>
          );
        })}

      </div>

      {/* INFO */}
      <div className="mt-6 bg-white/5 p-4 rounded-2xl border border-white/10 text-sm">

        <p className="text-yellow-400 font-semibold mb-2">
          💡 VIP Benefits
        </p>

        <ul className="space-y-1 text-gray-400 text-xs">
          <li>• Higher ROI on investments</li>
          <li>• Extra deposit bonuses</li>
          <li>• Faster withdrawals</li>
          <li>• Exclusive rewards & promotions</li>
        </ul>

      </div>

    </div>
  );
}