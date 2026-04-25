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
  const [displayBalance, setDisplayBalance] = useState(0);
  const [notify, setNotify] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // 🔐 AUTH
  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    loadUser();
  }, []);

  // 📡 LOAD USER
  const loadUser = async () => {
    try {
      const res = await API.get("/user/me");
      const data = res.data.user || res.data;
      setUser(data);
      setDisplayBalance(data.balance || 0);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  };

  // 💰 LIVE BALANCE
  useEffect(() => {
    if (!user?.balance) return;

    let current = user.balance;

    const interval = setInterval(() => {
      current += current * 0.00005;
      setDisplayBalance(current);
    }, 2000);

    return () => clearInterval(interval);
  }, [user]);

  // 🔔 NOTIFICATIONS
  useEffect(() => {
    const messages = [
      "💰 Deposit received",
      "📈 ROI added",
      "🎉 Team bonus earned",
    ];

    const interval = setInterval(() => {
      const msg = messages[Math.floor(Math.random() * messages.length)];
      setNotify(msg);
      setTimeout(() => setNotify(""), 3000);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  // ⏱️ COOLDOWN LOAD
  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = localStorage.getItem("withdrawTime");
    if (saved) {
      const diff = Math.floor((Date.now() - Number(saved)) / 1000);
      const remaining = 96 * 3600 - diff;
      if (remaining > 0) setCooldown(remaining);
    }
  }, []);

  // ⏱️ TIMER
  useEffect(() => {
    if (cooldown <= 0) return;

    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldown]);

  // ✅ FIXED FUNCTION
  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  };

  // LOADER
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#040406]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-[420px] mx-auto px-4 pb-28 text-white glow-bg">

      {/* 🔔 NOTIFY */}
      {notify && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-purple-600 px-4 py-2 rounded-xl z-50">
          {notify}
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center pt-5">
        <h1 className="font-bold text-xl text-glow">NovaCentral</h1>

        <button
          onClick={logout}
          className="text-sm text-red-400"
        >
          Logout 🚪
        </button>
      </div>

      {/* PROFILE */}
      <div className="flex items-center gap-3 mt-6">
        <div className="p-[2px] rounded-full bg-gradient-to-r from-purple-500 to-cyan-500">
          <Image
            src="/logo.png"
            alt="user"
            width={55}
            height={55}
            className="rounded-full bg-black"
          />
        </div>

        <div>
          <p className="text-gray-400 text-xs">Welcome Back</p>
          <h2 className="font-bold text-lg">{user?.username}</h2>
          <p className="text-[11px] text-gray-500">
            ID: {user?._id?.slice(0, 6)}
          </p>
        </div>
      </div>

      {/* BALANCE */}
      <div className="mt-6 glow-card">
        <p className="text-xs text-gray-400">Total Balance</p>

        <h1 className="text-3xl font-bold text-green-400 mt-2">
          ${displayBalance.toFixed(2)}
        </h1>

        {cooldown > 0 && (
          <p className="text-xs text-yellow-400 mt-2">
            ⏳ Withdraw in {formatTime(cooldown)}
          </p>
        )}
      </div>

      {/* ACTIONS */}
      <div className="grid grid-cols-4 gap-3 mt-6">
        <Action label="Deposit" icon="⬇️" onClick={() => router.push("/deposit")} />
        <Action label="Withdraw" icon="⬆️" onClick={() => router.push("/withdrawal")} />
        <Action label="Invest" icon="📊" onClick={() => router.push("/investment")} />
        <Action label="Team" icon="👥" onClick={() => router.push("/referral")} />
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 gap-3 mt-6">
        <Stat title="Earnings" value={user?.totalEarnings} />
        <Stat title="Today" value={user?.todayProfit} />
        <Stat title="Invested" value={user?.totalInvested} />
        <Stat title="Withdrawn" value={user?.totalWithdraw} />
      </div>

      <BottomNav />
    </div>
  );
}

/* ACTION */
function Action({ label, icon, onClick }: any) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="glow-card text-center active:scale-95 transition"
    >
      <div>{icon}</div>
      <p className="text-[10px]">{label}</p>
    </button>
  );
}

/* STAT */
function Stat({ title, value }: any) {
  return (
    <div className="glow-card">
      <p className="text-xs text-gray-400">{title}</p>
      <h4 className="text-sm text-cyan-400">
        ${Number(value || 0).toFixed(2)}
      </h4>
    </div>
  );
}

/* NAV */
function BottomNav() {
  const router = useRouter();
  const path = usePathname();

  const nav = [
    { name: "Home", path: "/dashboard" },
    { name: "Invest", path: "/investment" },
    { name: "Team", path: "/referral" },
    { name: "Wallet", path: "/deposit" }, // ✅ FIXED
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