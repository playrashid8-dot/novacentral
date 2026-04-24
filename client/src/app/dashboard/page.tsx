"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import API from "../../lib/api";
import { getUser, logout } from "../../lib/auth";

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 🔐 AUTH CHECK
  useEffect(() => {
    const u = getUser();

    if (!u) {
      router.push("/login");
      return;
    }

    loadUser();
  }, []);

  // 📡 LOAD USER FROM BACKEND
  const loadUser = async () => {
    try {
      const res = await API.get("/user/me"); // 🔥 better endpoint
      setUser(res.data.user || res.data);
    } catch (err) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  // 🔄 LOADING UI
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pb-28 text-white glow-bg relative">

      {/* HEADER */}
      <div className="flex justify-between items-center pt-5">
        <h1 className="font-bold text-xl text-glow">NovaCentral</h1>

        <button
          onClick={logout}
          className="text-sm text-red-400 hover:text-red-500"
        >
          Logout 🚪
        </button>
      </div>

      {/* PROFILE */}
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
          <h2 className="font-bold text-lg">
            {user?.username || "User"}
          </h2>
          <p className="text-xs text-gray-500">
            ID: {user?._id?.slice(0, 6)}
          </p>
        </div>
      </div>

      {/* 💰 BALANCE */}
      <div className="mt-6 glow-card">

        <p className="text-sm text-gray-200">Total Balance</p>

        <motion.h1
          key={user?.balance}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-4xl font-bold mt-2"
        >
          ${Number(user?.balance || 0).toFixed(2)}
        </motion.h1>

        <p className="text-sm opacity-80 mt-1">
          ≈ {Number(user?.balance || 0).toFixed(2)} USDT
        </p>

      </div>

      {/* ⚡ ACTIONS */}
      <div className="grid grid-cols-4 gap-3 mt-6">

        <Action label="Deposit" icon="⬇️" onClick={() => router.push("/deposit")} />
        <Action label="Withdraw" icon="⬆️" onClick={() => router.push("/withdraw")} />
        <Action label="Plans" icon="📊" onClick={() => router.push("/plans")} />
        <Action label="Team" icon="👥" onClick={() => router.push("/team")} />

      </div>

      {/* 📊 OVERVIEW */}
      <div className="mt-8">
        <h3 className="font-semibold text-lg">Overview</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">

        <Stat title="Total Earnings" value={`$${user?.totalEarnings || 0}`} />
        <Stat title="Today's Profit" value={`$${user?.todayProfit || 0}`} />
        <Stat title="Total Invested" value={`$${user?.totalInvested || 0}`} />
        <Stat title="Withdrawn" value={`$${user?.totalWithdraw || 0}`} />

      </div>

      {/* NAV */}
      <BottomNav />

    </div>
  );
}

/* ACTION */
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

/* STAT */
function Stat({ title, value }: any) {
  return (
    <div className="card">
      <p className="text-sm text-gray-400">{title}</p>
      <h4 className="font-bold text-lg mt-1 text-glow">{value}</h4>
    </div>
  );
}

/* NAV */
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
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[95%] max-w-[420px] bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl flex justify-around py-3">

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