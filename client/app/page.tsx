"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen px-4 py-6 text-white relative overflow-hidden">

      {/* 🔥 BACKGROUND */}
      <div className="absolute w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[140px] top-[-120px] left-[-120px]" />
      <div className="absolute w-[500px] h-[500px] bg-indigo-600 opacity-20 blur-[140px] bottom-[-120px] right-[-120px]" />

      <div className="max-w-[420px] mx-auto relative z-10">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="logo" width={36} height={36} className="rounded-full" />
            <h1 className="font-bold text-lg text-purple-400">NovaCentral</h1>
          </div>

          <button
            onClick={() => router.push("/login")}
            className="text-xs px-3 py-1 rounded-lg border border-white/10 hover:bg-white/10"
          >
            Login
          </button>
        </div>

        {/* 🔥 HERO (MAIN SELL POINT) */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl mb-6 shadow-xl"
        >
          <h2 className="text-2xl font-bold leading-tight">
            Earn <span className="text-purple-400">Daily Income</span> Automatically 💸
          </h2>

          <p className="text-gray-400 text-sm mt-2">
            Smart crypto earning system with ROI, referrals & passive rewards.
          </p>

          {/* CTA */}
          <button
            onClick={() => router.push("/signup")}
            className="mt-5 w-full bg-gradient-to-r from-purple-500 to-indigo-500 p-3 rounded-xl font-semibold shadow-lg hover:scale-105 active:scale-95 transition"
          >
            🚀 Start Now
          </button>
        </motion.div>

        {/* 📊 STATS (TRUST BUILD) */}
        <div className="grid grid-cols-3 gap-2 mb-6 text-center">
          <Stat value="$2.4M+" label="Paid" />
          <Stat value="25K+" label="Users" />
          <Stat value="24/7" label="Earning" />
        </div>

        {/* FEATURES */}
        <div className="space-y-3 mb-6">

          <Feature title="Daily ROI Income" desc="1% – 2.5% per day" />
          <Feature title="Instant Deposit" desc="USDT auto credit system" />
          <Feature title="Secure Withdraw" desc="96h protected system" />
          <Feature title="Referral Income" desc="Multi-level earning" />

        </div>

        {/* 💰 SIMPLE PLANS (REMOVE CONFUSION) */}
        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl mb-6">
          <h3 className="font-semibold mb-3 text-purple-400">Investment Plans</h3>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <Plan name="Basic" roi="1%" />
            <Plan name="Silver" roi="1.5%" />
            <Plan name="Gold" roi="2%" />
            <Plan name="VIP" roi="2.5%" />
          </div>
        </div>

        {/* FINAL CTA */}
        <button
          onClick={() => router.push("/signup")}
          className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 p-3 rounded-xl font-semibold shadow-lg hover:scale-105 active:scale-95 transition"
        >
          Join Now 🚀
        </button>

      </div>
    </div>
  );
}

/* 🔹 SMALL COMPONENTS */

function Feature({ title, desc }: any) {
  return (
    <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-gray-400">{desc}</p>
    </div>
  );
}

function Stat({ value, label }: any) {
  return (
    <div className="bg-white/5 border border-white/10 p-2 rounded-lg">
      <p className="text-sm font-bold text-purple-400">{value}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  );
}

function Plan({ name, roi }: any) {
  return (
    <div className="bg-black/40 p-2 rounded-lg text-center">
      <p className="text-xs text-gray-400">{name}</p>
      <p className="font-bold text-green-400">{roi}</p>
    </div>
  );
}