"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#040406] text-white px-4 py-6 relative overflow-hidden">

      {/* 🔥 BACKGROUND */}
      <div className="absolute w-[600px] h-[600px] bg-purple-600 opacity-20 blur-[160px] top-[-200px] left-[-200px]" />
      <div className="absolute w-[600px] h-[600px] bg-indigo-600 opacity-20 blur-[160px] bottom-[-200px] right-[-200px]" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.05)_1px,_transparent_1px)] [background-size:26px_26px]" />

      <div className="max-w-[420px] mx-auto relative z-10">

        {/* HEADER */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-8"
        >
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="NovaCentral" width={38} height={38}
              className="rounded-full shadow-[0_0_20px_rgba(168,85,247,0.9)]" />

            <h1 className="text-xl font-bold tracking-wide bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
              NovaCentral
            </h1>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => router.push("/login")}
              className="px-3 py-2 text-xs border border-purple-500/40 rounded-lg hover:bg-purple-500/10 transition"
            >
              Login
            </button>

            <button
              onClick={() => router.push("/signup")}
              className="px-3 py-2 text-xs bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg shadow-lg hover:scale-105 active:scale-95 transition"
            >
              Signup
            </button>
          </div>
        </motion.div>

        {/* HERO */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-[1px] rounded-3xl bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 mb-8 shadow-[0_0_40px_rgba(139,92,246,0.4)]"
        >
          <div className="bg-[#0b0b0f]/90 backdrop-blur-xl p-6 rounded-3xl">

            <h2 className="text-3xl font-bold leading-tight">
              Earn Daily Passive Income 💸
            </h2>

            <p className="text-gray-400 mt-2 text-sm">
              Smart staking • Referral rewards • Automated earning engine ⚡
            </p>

            {/* STATS */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <StatCard title="Total Paid" value="$2.4M+" color="text-purple-400" />
              <StatCard title="Users" value="25K+" color="text-indigo-400" />
            </div>

            <button
              onClick={() => router.push("/signup")}
              className="mt-6 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 p-3 rounded-xl font-semibold shadow-lg hover:scale-105 active:scale-95 transition"
            >
              🚀 Start Earning Now
            </button>

          </div>
        </motion.div>

        {/* FEATURES */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <FeatureCard icon="📈" title="Daily ROI" desc="1% – 2.5% stable income" />
          <FeatureCard icon="⚡" title="Auto Deposit" desc="Instant USDT credit" />
          <FeatureCard icon="🔐" title="Secure Vault" desc="Protected withdrawals" />
          <FeatureCard icon="🤝" title="Team Income" desc="Multi-level rewards" />
        </div>

        {/* 💰 EARNING SYSTEM */}
        <div className="bg-[#0b0b0f]/90 p-5 rounded-2xl border border-white/5 mb-8">
          <h3 className="text-lg font-semibold mb-3">💰 Earnings System</h3>

          <ul className="text-sm text-gray-300 space-y-2">
            <li>✔ Daily ROI Income (1% – 2.5%)</li>
            <li>✔ Automatic Profit Distribution</li>
            <li>✔ Compound Growth System 📊</li>
            <li>✔ 24/7 Earning Engine ⚡</li>
          </ul>
        </div>

        {/* 🏆 SALARY SYSTEM */}
        <div className="bg-[#0b0b0f]/90 p-5 rounded-2xl border border-white/5 mb-8">
          <h3 className="text-lg font-semibold mb-3">🏆 Salary System</h3>

          <ul className="text-sm text-gray-300 space-y-2">
            <li>🥇 Level 1 → Weekly Bonus</li>
            <li>🥈 Level 2 → Monthly Salary</li>
            <li>🥉 Level 3 → Leadership Rewards</li>
            <li>👑 VIP → Passive Salary Unlock</li>
          </ul>
        </div>

        {/* 👥 TEAM INCOME */}
        <div className="bg-[#0b0b0f]/90 p-5 rounded-2xl border border-white/5 mb-8">
          <h3 className="text-lg font-semibold mb-3">👥 Team Income</h3>

          <ul className="text-sm text-gray-300 space-y-2">
            <li>✔ Direct Referral Bonus</li>
            <li>✔ Multi-Level Commission</li>
            <li>✔ Leadership Rewards</li>
            <li>✔ Passive Team Earnings</li>
          </ul>
        </div>

        {/* VIP PLANS */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-[1px] rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 mb-8"
        >
          <div className="bg-[#0b0b0f] p-5 rounded-2xl">

            <h3 className="font-semibold mb-4 text-lg flex items-center gap-2">
              🔥 <span className="text-purple-400">VIP Plans</span>
            </h3>

            <ul className="space-y-2 text-sm text-gray-300">
              <li>⚡ 4 Days → 5%</li>
              <li>🚀 7 Days → 10%</li>
              <li>💰 15 Days → 20%</li>
              <li>👑 30 Days → 45%</li>
            </ul>

          </div>
        </motion.div>

        {/* ABOUT */}
        <div className="bg-[#0b0b0f]/90 backdrop-blur-xl p-5 rounded-2xl border border-white/5">
          <h3 className="font-semibold mb-3 text-lg">Why NovaCentral?</h3>

          <ul className="space-y-2 text-sm text-gray-400">
            <li>✔ Fully automated earning system</li>
            <li>✔ Real-time tracking</li>
            <li>✔ Secure withdrawals</li>
            <li>✔ Passive income engine</li>
            <li>✔ Global crypto platform 🌍</li>
          </ul>
        </div>

      </div>
    </div>
  );
}

/* COMPONENTS */
function FeatureCard({ icon, title, desc }: any) {
  return (
    <motion.div whileHover={{ scale: 1.05 }}
      className="bg-[#0b0b0f]/90 p-4 rounded-2xl border border-white/5 hover:border-purple-500 transition shadow-lg">
      <p className="text-xl">{icon}</p>
      <h3 className="font-semibold mt-2 text-sm">{title}</h3>
      <p className="text-xs text-gray-400">{desc}</p>
    </motion.div>
  );
}

function StatCard({ title, value, color }: any) {
  return (
    <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
      <p className="text-xs text-gray-400">{title}</p>
      <h3 className={`text-lg font-bold ${color}`}>{value}</h3>
    </div>
  );
}