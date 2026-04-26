"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { getApiErrorMessage } from "../../lib/api";
import { getUser, logout } from "../../lib/auth";
import { fetchCurrentUser } from "../../lib/session";
import AppToast from "../../components/AppToast";
import ProtectedRoute from "../../components/ProtectedRoute";

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [displayBalance, setDisplayBalance] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  /* 🔐 AUTH */
  useEffect(() => {
    const cachedUser = getUser();
    if (cachedUser) {
      setUser(cachedUser);
      setDisplayBalance(cachedUser.balance || 0);
    }
    loadUser(false);

    const onFocus = () => loadUser(true);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  /* 📡 LOAD USER */
  const loadUser = async (silent: boolean) => {
    try {
      if (!silent) setLoading(true);
      const data = await fetchCurrentUser();
      if (!data) throw new Error("No user data");

      setUser(data);
      setDisplayBalance(data.balance || 0);
    } catch (err: any) {
      if (!silent) {
        showToast(getApiErrorMessage(err, "Session expired 🔒"));
      }
      logout();
    } finally {
      if (!silent) setLoading(false);
    }
  };

  /* 💰 LIVE BALANCE */
  useEffect(() => {
    if (!user?.balance) return;

    let current = user.balance;

    const interval = setInterval(() => {
      current += current * 0.00005;
      setDisplayBalance(current);
    }, 2000);

    return () => clearInterval(interval);
  }, [user]);

  /* ⏱️ COOLDOWN */
  useEffect(() => {
    const saved = localStorage.getItem("withdrawTime");

    if (saved) {
      const diff = Math.floor((Date.now() - Number(saved)) / 1000);
      const remaining = 96 * 3600 - diff;

      if (remaining > 0) setCooldown(remaining);
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;

    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldown]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  };

  /* ⏳ LOADER */
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
    <ProtectedRoute>
    <div className="min-h-screen max-w-[420px] mx-auto px-4 pb-28 text-white">
      <AppToast message={toast} />

      {/* HEADER */}
      <div className="flex justify-between items-center pt-5">
        <h1 className="font-bold text-xl text-purple-400">
          NovaCentral 🚀
        </h1>

        <button
          onClick={logout}
          className="text-sm text-red-400 hover:opacity-70"
        >
          Logout
        </button>
      </div>

      {/* PROFILE */}
      <div className="flex items-center gap-3 mt-6">
        <Image
          src="/logo.png"
          alt="user"
          width={55}
          height={55}
          className="rounded-full border border-purple-500"
        />

        <div>
          <p className="text-gray-400 text-xs">Welcome Back</p>
          <h2 className="font-bold text-lg">{user?.username}</h2>
          <p className="text-[11px] text-gray-500">
            ID: {user?._id?.slice(0, 6)}
          </p>
        </div>
      </div>

      {/* BALANCE */}
      <div className="mt-6 bg-white/5 p-5 rounded-2xl border border-white/10">
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

      {/* 🔥 ACTION BUTTONS (FIXED) */}
      <div className="grid grid-cols-3 gap-3 mt-6">
        <Action label="Deposit" icon="⬇️" onClick={() => router.push("/deposit")} />
        <Action label="Withdraw" icon="⬆️" onClick={() => router.push("/withdrawal")} />
        <Action label="Invest" icon="📊" onClick={() => router.push("/investment")} />
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 gap-3 mt-6">
        <Stat title="Earnings" value={user?.totalEarnings} />
        <Stat title="Today" value={user?.todayProfit} />
        <Stat title="Invested" value={user?.totalInvested} />
        <Stat title="Withdrawn" value={user?.totalWithdraw} />
      </div>

      {/* 🔻 BOTTOM NAV (UPDATED) */}
      <BottomNav />
    </div>
    </ProtectedRoute>
  );
}

/* 🔘 ACTION */
function Action({ label, icon, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="bg-white/5 border border-white/10 rounded-xl p-3 text-center active:scale-95 transition"
    >
      <div className="text-lg">{icon}</div>
      <p className="text-[10px]">{label}</p>
    </button>
  );
}

/* 📊 STAT */
function Stat({ title, value }: any) {
  return (
    <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
      <p className="text-xs text-gray-400">{title}</p>
      <h4 className="text-sm text-cyan-400">
        ${Number(value || 0).toFixed(2)}
      </h4>
    </div>
  );
}

/* 📱 BOTTOM NAV FINAL */
function BottomNav() {
  const router = useRouter();
  const path = usePathname();

  const nav = [
    { name: "Home", path: "/dashboard" },
    { name: "Team", path: "/referral" },
    { name: "History", path: "/history" },
    { name: "Profile", path: "/profile" },
  ];

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[95%] max-w-[420px] bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl flex justify-around py-3 z-50">

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