"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function Home() {
  const router = useRouter();

  const [balance, setBalance] = useState(2458920);

  useEffect(() => {
    const interval = setInterval(() => {
      setBalance((prev) => prev + Math.floor(Math.random() * 50));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden">

      {/* 🔥 BACKGROUND GLOW */}
      <div className="absolute w-[600px] h-[600px] bg-purple-600 opacity-20 blur-[160px] top-[-200px] left-[-200px]" />
      <div className="absolute w-[600px] h-[600px] bg-indigo-600 opacity-20 blur-[160px] bottom-[-200px] right-[-200px]" />

      {/* NAVBAR */}
      <div className="flex justify-between items-center px-5 py-4 relative z-10">

        {/* LOGO */}
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="NovaCentral"
            width={34}
            height={34}
            className="rounded-full shadow-[0_0_15px_rgba(168,85,247,0.7)]"
          />
          <span className="font-bold text-lg tracking-wide">
            NovaCentral
          </span>
        </div>

        {/* BUTTONS */}
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/login")}
            className="px-4 py-2 rounded-xl border border-purple-500/40 hover:bg-purple-500/10 transition"
          >
            Login
          </button>

          <button
            onClick={() => router.push("/signup")}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 shadow-lg hover:scale-105 transition"
          >
            Signup
          </button>
        </div>
      </div>

      {/* HERO */}
      <div className="px-5 mt-6 relative z-10">

        <div className="rounded-3xl p-[1px] bg-gradient-to-r from-purple-500 to-indigo-500">

          <div className="rounded-3xl bg-[#0b0b0f]/90 backdrop-blur-xl p-6">

            <h2 className="text-3xl font-bold mb-2">
              Earn Crypto Daily
            </h2>

            <p className="text-gray-400 mb-6">
              Smart staking, referral income & automated ROI system
            </p>

            {/* 🔥 LIVE COUNTER */}
            <motion.div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
              <p className="text-gray-400 text-sm">
                Platform Earnings
              </p>

              <motion.h3
                key={balance}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-bold text-purple-400"
              >
                ${balance.toLocaleString()}
              </motion.h3>
            </motion.div>

            {/* CTA */}
            <button
              onClick={() => router.push("/signup")}
              className="w-full py-4 rounded-2xl text-lg font-semibold 
              bg-gradient-to-r from-purple-500 to-indigo-500
              shadow-[0_0_25px_rgba(168,85,247,0.6)]
              hover:shadow-[0_0_40px_rgba(168,85,247,1)]
              hover:scale-105 transition-all duration-300"
            >
              Start Earning 🚀
            </button>

          </div>
        </div>
      </div>

      {/* TRUST STATS */}
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

      {/* 🔥 LIVE ACTIVITY */}
      <div className="px-5 pb-10 text-sm text-gray-400 space-y-2">
        <p>🟢 Ali deposited $120</p>
        <p>🟢 Ahmed earned $15 ROI</p>
        <p>🟢 Sara withdrew $300</p>
      </div>

    </div>
  );
}

/* COMPONENTS */

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