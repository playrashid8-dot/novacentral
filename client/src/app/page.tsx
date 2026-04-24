"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#07070a] text-white px-5 py-6 relative overflow-hidden">

      {/* 🔥 BACKGROUND GLOW */}
      <div className="absolute w-[400px] h-[400px] bg-purple-600 opacity-20 blur-[120px] top-[-100px] left-[-100px]" />
      <div className="absolute w-[400px] h-[400px] bg-indigo-600 opacity-20 blur-[120px] bottom-[-100px] right-[-100px]" />

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 relative z-10">
        <h1 className="text-xl font-bold">🚀 NovaCentral</h1>

        <div className="flex gap-2">
          <button
            onClick={() => router.push("/login")}
            className="px-4 py-2 text-sm border border-purple-500 rounded-lg"
          >
            Login
          </button>

          <button
            onClick={() => router.push("/signup")}
            className="px-4 py-2 text-sm bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg"
          >
            Signup
          </button>
        </div>
      </div>

      {/* HERO */}
      <div className="relative z-10 p-[1px] rounded-3xl bg-gradient-to-r from-purple-500 to-indigo-500 mb-6">
        <div className="bg-[#0b0b0f]/90 backdrop-blur-xl p-6 rounded-3xl">

          <h2 className="text-2xl font-bold leading-tight">
            Hybrid Crypto Earning Platform
          </h2>

          <p className="text-gray-400 mt-2 text-sm">
            Earn daily profits with staking, referral income, and smart investment system.
          </p>

          <button
            onClick={() => router.push("/signup")}
            className="mt-5 w-full bg-gradient-to-r from-purple-500 to-indigo-500 p-3 rounded-xl font-semibold"
          >
            Start Earning 🚀
          </button>

        </div>
      </div>

      {/* FEATURES */}
      <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">

        <Card title="Daily ROI" desc="1% - 2.5% profit" icon="📈" />
        <Card title="Instant Deposit" desc="Auto balance update" icon="💰" />
        <Card title="Secure Withdraw" desc="96h system" icon="🏦" />
        <Card title="Referral Income" desc="Team earning" icon="🤝" />

      </div>

      {/* PROJECT INFO */}
      <div className="bg-[#111827]/80 backdrop-blur-xl p-5 rounded-2xl relative z-10 border border-white/5">

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

/* 🔹 CARD COMPONENT */
function Card({ title, desc, icon }: any) {
  return (
    <div className="bg-[#111827]/80 backdrop-blur-xl p-4 rounded-2xl border border-white/5 hover:scale-105 hover:border-purple-500 transition">
      <p className="text-xl">{icon}</p>
      <h3 className="font-semibold mt-1">{title}</h3>
      <p className="text-sm text-gray-400">{desc}</p>
    </div>
  );
}