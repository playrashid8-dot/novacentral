"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";

export default function Dashboard() {
  const [balance, setBalance] = useState(12458.75);
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      setBalance((prev) => prev + Math.random() * 2);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen px-4 pb-28 text-white glow-bg relative">

      {/* HEADER */}
      <div className="flex justify-between items-center pt-5 z-10 relative">
        <h1 className="font-bold text-xl text-glow">NovaCentral</h1>

        <div className="flex gap-3 text-lg">
          <span className="hover:scale-110 cursor-pointer">🔔</span>
          <span className="hover:scale-110 cursor-pointer">☰</span>
        </div>
      </div>

      {/* PROFILE */}
      <div className="flex items-center gap-3 mt-6 relative z-10">
        <Image
          src="/logo.png"
          alt="user"
          width={60}
          height={60}
          className="rounded-full border border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.8)]"
        />

        <div>
          <p className="text-gray-400 text-sm">Welcome Back</p>
          <h2 className="font-bold text-lg">Ahmed Khan</h2>
          <p className="text-xs text-gray-500">ID: NC123456</p>
        </div>
      </div>

      {/* BALANCE */}
      <div className="mt-6 glow-card relative z-10">

        <p className="text-sm text-gray-200">Total Balance</p>

        <motion.h1
          key={balance}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-4xl font-bold mt-2"
        >
          ${balance.toFixed(2)}
        </motion.h1>

        <p className="text-sm opacity-80 mt-1">
          ≈ {(balance * 0.26).toFixed(2)} USDT
        </p>

      </div>

      {/* QUICK ACTIONS */}
      <div className="grid grid-cols-4 gap-3 mt-6 relative z-10">

        <Action label="Deposit" icon="⬇️" onClick={() => router.push("/deposit")} />
        <Action label="Withdraw" icon="⬆️" onClick={() => router.push("/withdraw")} />
        <Action label="Plans" icon="📊" onClick={() => router.push("/plans")} />
        <Action label="Team" icon="👥" onClick={() => router.push("/team")} />

      </div>

      {/* OVERVIEW */}
      <div className="mt-8 flex justify-between items-center">
        <h3 className="font-semibold text-lg">Overview</h3>
        <button
          onClick={() => router.push("/earnings")}
          className="text-purple-400 text-sm"
        >
          View All
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">

        <Stat title="Total Earnings" value="$3,245" />
        <Stat title="Today's Profit" value="$124" />
        <Stat title="Total Invested" value="$5,000" />
        <Stat title="Withdrawn" value="$1,250" />

      </div>

      {/* BOTTOM NAV */}
      <BottomNav />

    </div>
  );
}

/* ACTION BUTTON */
function Action({ label, icon, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="card text-center active:scale-95 hover:scale-105 transition"
    >
      <div className="text-xl">{icon}</div>
      <p className="text-xs mt-1">{label}</p>
    </button>
  );
}

/* STATS */
function Stat({ title, value }: any) {
  return (
    <div className="card">
      <p className="text-sm text-gray-400">{title}</p>
      <h4 className="font-bold text-lg mt-1 text-glow">{value}</h4>
    </div>
  );
}

/* BOTTOM NAV */
function BottomNav() {
  const router = useRouter();
  const path = usePathname();

  const nav = [
    { name: "Home", path: "/dashboard" },
    { name: "Earnings", path: "/earnings" },
    { name: "Team", path: "/team" },
    { name: "Wallet", path: "/wallet" },
    { name: "Profile", path: "/profile" },
  ];

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[95%] max-w-[420px] bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl flex justify-around py-3 shadow-[0_0_20px_rgba(168,85,247,0.3)]">

      {nav.map((item) => (
        <button
          key={item.name}
          onClick={() => router.push(item.path)}
          className={`text-sm ${
            path === item.path
              ? "text-purple-400"
              : "text-gray-400"
          }`}
        >
          {item.name}
        </button>
      ))}

    </div>
  );
}