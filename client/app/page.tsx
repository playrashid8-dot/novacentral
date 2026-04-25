"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#040406] text-white px-5 py-6 relative overflow-hidden">

      {/* 🔥 BACKGROUND LIGHTS */}
      <div className="absolute w-[600px] h-[600px] bg-purple-600 opacity-20 blur-[160px] top-[-200px] left-[-200px]" />
      <div className="absolute w-[600px] h-[600px] bg-indigo-600 opacity-20 blur-[160px] bottom-[-200px] right-[-200px]" />

      {/* GRID */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.05)_1px,_transparent_1px)] [background-size:26px_26px]" />

      {/* HEADER */}
      <div className="flex justify-between items-center mb-8 relative z-10">

        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="NovaCentral"
            width={36}
            height={36}
            className="rounded-full shadow-[0_0_20px_rgba(168,85,247,0.9)]"
          />
          <h1 className="text-xl font-bold tracking-wide bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            NovaCentral
          </h1>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => router.push("/login")}
            className="px-4 py-2 text-sm border border-purple-500/40 rounded-lg hover:bg-purple-500/10 transition"
          >
            Login
          </button>

          <button
            onClick={() => router.push("/signup")}
            className="px-4 py-2 text-sm bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg shadow-lg hover:scale-105 active:scale-95 transition"
          >
            Signup
          </button>
        </div>
      </div>

      {/* HERO */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 p-[1px] rounded-3xl bg-gradient-to-r from-purple-500 to-indigo-500 mb-8"
      >
        <div className="bg-[#0b0b0f]/90 backdrop-blur-xl p-7 rounded-3xl">

          <h2 className="text-4xl font-bold leading-tight">
            Earn Daily Passive Income 💸
          </h2>

          <p className="text-gray-400 mt-3 text-sm">
            Smart staking • Referral rewards • Automated earnings system
          </p>

          {/* LIVE STATS */}
          <div className="mt-5 grid grid-cols-2 gap-3">

            <div className="bg-white/5 p-4 rounded-xl text-center">
              <p className="text-xs text-gray-400">Total Paid</p>
              <h3 className="text-lg font-bold text-purple-400">
                $2.4M+
              </h3>
            </div>

            <div className="bg-white/5 p-4 rounded-xl text-center">
              <p className="text-xs text-gray-400">Active Users</p>
              <h3 className="text-lg font-bold text-indigo-400">
                25K+
              </h3>
            </div>

          </div>

          <button
            onClick={() => router.push("/signup")}
            className="mt-6 w-full bg-gradient-to-r from-purple-500 to-indigo-500 p-3 rounded-xl font-semibold shadow-lg hover:scale-105 active:scale-95 transition"
          >
            Start Earning 🚀
          </button>

        </div>
      </motion.div>

      {/* FEATURES */}
      <div className="grid grid-cols-2 gap-4 mb-8 relative z-10">

        <Card title="Daily ROI" desc="Stable profit system" icon="📈" />
        <Card title="Auto Deposit" desc="Instant credit system" icon="⚡" />
        <Card title="Secure Withdraw" desc="Protected vault system" icon="🔐" />
        <Card title="Team Income" desc="Multi-level rewards" icon="🤝" />

      </div>

      {/* BIG STATS */}
      <div className="grid grid-cols-3 gap-3 mb-8 text-center">

        <Stat title="Users" value="25K+" />
        <Stat title="Deposits" value="$8M+" />
        <Stat title="ROI Paid" value="$2M+" />

      </div>

      {/* VIP PLANS */}
      <div className="bg-[#0b0b0f]/90 p-5 rounded-2xl border border-white/5 mb-8">

        <h3 className="font-semibold mb-4 text-lg">🔥 VIP Staking Plans</h3>

        <ul className="space-y-2 text-sm text-gray-300">
          <li>⚡ 4 Days → 5%</li>
          <li>🚀 7 Days → 10%</li>
          <li>💰 15 Days → 20%</li>
          <li>👑 30 Days → 45%</li>
        </ul>

      </div>

      {/* ABOUT */}
      <div className="bg-[#0b0b0f]/90 backdrop-blur-xl p-5 rounded-2xl border border-white/5 relative z-10">

        <h3 className="font-semibold mb-3 text-lg">Why NovaCentral?</h3>

        <ul className="space-y-2 text-sm text-gray-400">
          <li>✔ Fully automated earning system</li>
          <li>✔ Real-time deposit tracking</li>
          <li>✔ Secure withdrawal system</li>
          <li>✔ Referral & leadership rewards</li>
          <li>✔ 24/7 running platform</li>
        </ul>

      </div>

    </div>
  );
}

/* 🔹 FEATURE CARD */
function Card({ title, desc, icon }: any) {
  return (
    <div className="bg-[#0b0b0f]/90 backdrop-blur-xl p-4 rounded-2xl border border-white/5 hover:scale-105 hover:border-purple-500 transition shadow-lg">
      <p className="text-2xl">{icon}</p>
      <h3 className="font-semibold mt-2">{title}</h3>
      <p className="text-sm text-gray-400">{desc}</p>
    </div>
  );
}

/* 🔹 STATS */
function Stat({ title, value }: any) {
  return (
    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
      <p className="text-xs text-gray-400">{title}</p>
      <h4 className="font-bold text-purple-400">{value}</h4>
    </div>
  );
}