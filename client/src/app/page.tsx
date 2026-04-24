"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#050507] text-white relative overflow-hidden">

      {/* 🔥 BACKGROUND GLOW */}
      <div className="absolute w-[600px] h-[600px] bg-purple-600 opacity-20 blur-[160px] top-[-200px] left-[-200px]" />
      <div className="absolute w-[600px] h-[600px] bg-indigo-600 opacity-20 blur-[160px] bottom-[-200px] right-[-200px]" />

      {/* NAVBAR */}
      <div className="flex justify-between items-center px-5 py-4 relative z-10">

        <h1 className="text-xl font-bold tracking-wide">
          🚀 NovaCentral
        </h1>

        <div className="flex gap-2">
          <button
            onClick={() => router.push("/login")}
            className="px-4 py-2 rounded-xl border border-purple-500/40 hover:bg-purple-500/10"
          >
            Login
          </button>

          <button
            onClick={() => router.push("/signup")}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500"
          >
            Signup
          </button>
        </div>

      </div>

      {/* 🔥 HERO */}
      <div className="px-5 mt-6 relative z-10">

        <div className="rounded-3xl p-[1px] bg-gradient-to-r from-purple-500 to-indigo-500">

          <div className="rounded-3xl bg-[#0b0b0f]/90 backdrop-blur-xl p-6">

            {/* TITLE */}
            <h2 className="text-3xl font-bold leading-tight mb-3">
              Earn Crypto Daily
            </h2>

            <p className="text-gray-400 mb-6">
              Smart staking, referral income & automated ROI system
            </p>

            {/* 🔥 LIVE COUNTER */}
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6"
            >
              <p className="text-gray-400 text-sm">Platform Earnings</p>
              <motion.h3
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-2xl font-bold text-purple-400"
              >
                $2,458,920
              </motion.h3>
            </motion.div>

            {/* CTA */}
            <button
              onClick={() => router.push("/signup")}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 text-lg font-semibold shadow-lg hover:scale-105 transition"
            >
              Start Earning 🚀
            </button>

          </div>
        </div>
      </div>

      {/* 🔥 TRUST STATS */}
      <div className="grid grid-cols-3 gap-3 px-5 mt-6">

        <Stat title="Users" value="25K+" />
        <Stat title="Deposits" value="$8M+" />
        <Stat title="Paid ROI" value="$2M+" />

      </div>

      {/* FEATURES */}
      <div className="grid grid-cols-2 gap-4 px-5 mt-6 pb-20">

        <Feature icon="📈" title="Daily ROI" desc="1% – 2.5%" />
        <Feature icon="💰" title="Instant Deposit" desc="Auto update" />
        <Feature icon="🏦" title="Secure Withdraw" desc="96h delay" />
        <Feature icon="🤝" title="Team Income" desc="Referral system" />

      </div>

    </div>
  );
}

/* 🔥 COMPONENTS */

function Stat({ title, value }: any) {
  return (
    <div className="bg-white/5 border border-white/10 p-3 rounded-xl text-center">
      <p className="text-xs text-gray-400">{title}</p>
      <p className="font-bold text-purple-400">{value}</p>
    </div>
  );
}

function Feature({ icon, title, desc }: any) {
  return (
    <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
      <div className="text-2xl mb-2">{icon}</div>
      <p className="font-semibold">{title}</p>
      <p className="text-gray-400 text-sm">{desc}</p>
    </div>
  );
}