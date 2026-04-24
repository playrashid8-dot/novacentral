"use client";

import { useEffect, useState } from "react";

export default function Dashboard() {
  const [balance, setBalance] = useState(1250);

  // 🔥 LIVE EARNING EFFECT
  useEffect(() => {
    const interval = setInterval(() => {
      setBalance((prev) => prev + Math.random() * 2);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-white pb-24 px-4">

      {/* HEADER */}
      <div className="flex justify-between items-center py-4">
        <h1 className="text-xl font-bold">🚀 NovaCentral</h1>
        <span className="text-gray-400 text-sm">Dashboard</span>
      </div>

      {/* BALANCE CARD */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-3xl shadow-2xl mb-6 relative overflow-hidden">

        <p className="text-sm opacity-80">Total Balance</p>

        <h2 className="text-3xl font-bold mt-2">
          ${balance.toFixed(2)}
        </h2>

        <div className="flex gap-3 mt-4">
          <button className="bg-white/20 px-4 py-2 rounded-xl backdrop-blur">
            Deposit
          </button>
          <button className="bg-white/20 px-4 py-2 rounded-xl backdrop-blur">
            Withdraw
          </button>
        </div>

        {/* Glow Effect */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500 opacity-30 blur-3xl"></div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card title="ROI" desc="Daily Profit" icon="📈" />
        <Card title="Deposit" desc="Instant" icon="💰" />
        <Card title="Withdraw" desc="96h Delay" icon="🏦" />
        <Card title="Team" desc="Referral Income" icon="🤝" />
      </div>

      {/* INVESTMENT PLANS */}
      <h2 className="text-lg font-semibold mb-3">Investment Plans</h2>

      <div className="space-y-3">
        <Plan name="Starter Plan" roi="1% Daily" price="$50" />
        <Plan name="Pro Plan" roi="2% Daily" price="$200" />
        <Plan name="VIP Plan" roi="2.5% Daily" price="$500" />
      </div>

      {/* BOTTOM NAV */}
      <BottomNav />

    </div>
  );
}

/* COMPONENTS */

function Card({ title, desc, icon }: any) {
  return (
    <div className="bg-[#111827] p-4 rounded-2xl shadow hover:scale-105 transition">
      <p className="text-xl">{icon}</p>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-gray-400">{desc}</p>
    </div>
  );
}

function Plan({ name, roi, price }: any) {
  return (
    <div className="bg-[#111827] p-4 rounded-2xl flex justify-between items-center hover:border-purple-500 border border-transparent transition">
      <div>
        <h3 className="font-semibold">{name}</h3>
        <p className="text-sm text-gray-400">{roi}</p>
      </div>
      <span className="font-bold">{price}</span>
    </div>
  );
}

function BottomNav() {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#111827] border-t border-gray-800 flex justify-around py-3 text-sm">

      <NavItem label="Home" active />
      <NavItem label="Wallet" />
      <NavItem label="Team" />
      <NavItem label="Profile" />

    </div>
  );
}

function NavItem({ label, active }: any) {
  return (
    <div className={`flex flex-col items-center ${active ? "text-purple-500" : "text-gray-400"}`}>
      <span>●</span>
      <span>{label}</span>
    </div>
  );
}