"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#050507] text-white px-5 py-6 relative overflow-hidden">

      {/* 🔥 BACKGROUND GLOW */}
      <div className="absolute w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[140px] top-[-150px] left-[-150px]" />
      <div className="absolute w-[500px] h-[500px] bg-indigo-600 opacity-20 blur-[140px] bottom-[-150px] right-[-150px]" />

      {/* GRID OVERLAY */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.04)_1px,_transparent_1px)] [background-size:28px_28px]" />

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 relative z-10">

        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="NovaCentral"
            width={32}
            height={32}
            className="rounded-full shadow-[0_0_15px_rgba(168,85,247,0.7)]"
          />
          <h1 className="text-lg font-bold tracking-wide">NovaCentral</h1>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => router.push("/login")}
            className="px-4 py-2 text-sm border border-purple-500 rounded-lg hover:bg-purple-500/10 transition"
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
        className="relative z-10 p-[1px] rounded-3xl bg-gradient-to-r from-purple-500 to-indigo-500 mb-6"
      >
        <div className="bg-[#0b0b0f]/90 backdrop-blur-xl p-6 rounded-3xl">

          <h2 className="text-3xl font-bold leading-tight">
            Earn Crypto Daily 💰
          </h2>

          <p className="text-gray-400 mt-2 text-sm">
            Smart staking, referral income & automated ROI system
          </p>

          {/* LIVE STATS */}
          <div className="mt-4 bg-white/5 p-3 rounded-xl text-center">
            <p className="text-xs text-gray-400">Platform Earnings</p>
            <h3 className="text-xl font-bold text-purple-400">
              $2,458,920
            </h3>
          </div>

          <button
            onClick={() => router.push("/signup")}
            className="mt-5 w-full bg-gradient-to-r from-purple-500 to-indigo-500 p-3 rounded-xl font-semibold shadow-lg hover:scale-105 active:scale-95 transition"
          >
            Start Earning 🚀
          </button>

        </div>
      </motion.div>

      {/* FEATURES */}
      <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">

        <Card title="Daily ROI" desc="1% - 2.5% profit" icon="📈" />
        <Card title="Instant Deposit" desc="Auto balance update" icon="💰" />
        <Card title="Secure Withdraw" desc="96h system" icon="🏦" />
        <Card title="Referral Income" desc="Team earning" icon="🤝" />

      </div>

      {/* STATS STRIP */}
      <div className="grid grid-cols-3 gap-3 mb-6 text-center">

        <Stat title="Users" value="25K+" />
        <Stat title="Deposits" value="$8M+" />
        <Stat title="Paid ROI" value="$2M+" />

      </div>

      {/* ABOUT */}
      <div className="bg-[#0b0b0f]/80 backdrop-blur-xl p-5 rounded-2xl border border-white/5 relative z-10">

        <h3 className="font-semibold mb-3">About NovaCentral</h3>

        <ul className="space-y-2 text-sm text-gray-400">
          <li>✔ Daily ROI earning system</li>
          <li>✔ Multiple staking plans</li>
          <li>✔ Instant deposit credit</li>
          <li>✔ 96 hours secure withdrawal</li>
          <li>✔ Referral & team income system</li>
        </ul>

      </div>

    </div>
  );
}

/* 🔹 FEATURE CARD */
function Card({ title, desc, icon }: any) {
  return (
    <div className="bg-[#0b0b0f]/80 backdrop-blur-xl p-4 rounded-2xl border border-white/5 hover:scale-105 hover:border-purple-500 transition shadow-md">
      <p className="text-xl">{icon}</p>
      <h3 className="font-semibold mt-1">{title}</h3>
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