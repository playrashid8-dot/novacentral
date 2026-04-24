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
      setBalance((prev) => prev + Math.random() * 3);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#050507] text-white pb-24 px-4">

      {/* 🔥 HEADER */}
      <div className="flex justify-between items-center pt-5">
        <h1 className="font-bold text-lg">NovaCentral</h1>
        <div className="flex gap-3">
          <span>🔔</span>
          <span>☰</span>
        </div>
      </div>

      {/* 👤 PROFILE */}
      <div className="flex items-center gap-3 mt-6">
        <Image
          src="/logo.png"
          alt="user"
          width={60}
          height={60}
          className="rounded-full border border-purple-500"
        />
        <div>
          <p className="text-gray-400 text-sm">Welcome Back</p>
          <h2 className="font-bold text-lg">Ahmed Khan</h2>
          <p className="text-xs text-gray-500">ID: NC123456</p>
        </div>
      </div>

      {/* 💰 BALANCE CARD */}
      <div className="mt-6 rounded-3xl p-[1px] bg-gradient-to-r from-purple-500 to-indigo-500">
        <div className="bg-[#0b0b0f] rounded-3xl p-5">

          <p className="text-gray-400 text-sm">Total Balance</p>

          <motion.h1
            key={balance}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-3xl font-bold text-purple-400 mt-2"
          >
            ${balance.toFixed(2)}
          </motion.h1>

          <p className="text-sm text-gray-500 mt-1">
            ≈ {(balance * 0.26).toFixed(2)} USDT
          </p>

        </div>
      </div>

      {/* ⚡ QUICK ACTIONS (FIXED) */}
      <div className="grid grid-cols-4 gap-3 mt-6">

        <Action
          label="Deposit"
          icon="⬇️"
          color="from-purple-500 to-purple-700"
          onClick={() => router.push("/deposit")}
        />

        <Action
          label="Withdraw"
          icon="⬆️"
          color="from-yellow-500 to-orange-600"
          onClick={() => router.push("/withdraw")}
        />

        <Action
          label="Plan"
          icon="🔒"
          color="from-blue-500 to-blue-700"
          onClick={() => router.push("/plans")}
        />

        <Action
          label="Team"
          icon="👥"
          color="from-green-500 to-green-700"
          onClick={() => router.push("/team")}
        />

      </div>

      {/* 📊 OVERVIEW */}
      <div className="mt-6 flex justify-between items-center">
        <h3 className="font-semibold">Overview</h3>
        <button
          onClick={() => router.push("/earnings")}
          className="text-purple-400 text-sm"
        >
          View All
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">

        <Stat title="Total Earnings" value="$3,245" color="green" />
        <Stat title="Today's Profit" value="$124" color="blue" />
        <Stat title="Total Invested" value="$5,000" color="yellow" />
        <Stat title="Total Withdraw" value="$1,250" color="purple" />

      </div>

      {/* 📱 BOTTOM NAV (FIXED) */}
      <BottomNav />

    </div>
  );
}

/* 🔥 ACTION BUTTON */
function Action({ label, icon, color, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-xl bg-gradient-to-br ${color} text-center active:scale-95 transition`}
    >
      <div className="text-xl">{icon}</div>
      <p className="text-xs mt-1">{label}</p>
    </button>
  );
}

/* 📊 STATS */
function Stat({ title, value, color }: any) {
  const colors: any = {
    green: "from-green-500/20 to-green-700/20",
    blue: "from-blue-500/20 to-blue-700/20",
    yellow: "from-yellow-500/20 to-yellow-700/20",
    purple: "from-purple-500/20 to-purple-700/20",
  };

  return (
    <div className={`p-4 rounded-2xl bg-gradient-to-br ${colors[color]} border border-white/10`}>
      <p className="text-sm text-gray-400">{title}</p>
      <h4 className="font-bold text-lg mt-1">{value}</h4>
    </div>
  );
}

/* 📱 BOTTOM NAV WORKING */
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
    <div className="fixed bottom-0 left-0 right-0 bg-black/90 border-t border-white/10 flex justify-around py-3 text-sm">

      {nav.map((item) => (
        <button
          key={item.name}
          onClick={() => router.push(item.path)}
          className={`${
            path === item.path ? "text-purple-400" : "text-gray-400"
          }`}
        >
          {item.name}
        </button>
      ))}

    </div>
  );
}