"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { getApiErrorMessage } from "../../lib/api";
import { logout } from "../../lib/auth";
import { fetchCurrentUser } from "../../lib/session";
import { claimHybridRoi, fetchHybridSummary } from "../../lib/hybrid";
import AppToast from "../../components/AppToast";
import ProtectedRoute from "../../components/ProtectedRoute";

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [displayBalance, setDisplayBalance] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [toast, setToast] = useState("");
  const [hybrid, setHybrid] = useState<any>(null);
  const [roiLoading, setRoiLoading] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  /* 🔐 AUTH */
  useEffect(() => {
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
      const [data, hybridData] = await Promise.all([
        fetchCurrentUser(),
        fetchHybridSummary().catch(() => null),
      ]);
      if (!data) throw new Error("No user data");

      setUser(data);
      setDisplayBalance(data.balance || 0);
      setHybrid(hybridData);
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
    setCooldown(0);
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

  const roiCooldownMs = hybrid?.lastDailyClaim
    ? Math.max(
        0,
        24 * 60 * 60 * 1000 - (Date.now() - new Date(hybrid.lastDailyClaim).getTime())
      )
    : 0;

  const handleClaimRoi = async () => {
    if (roiLoading) return;

    try {
      setRoiLoading(true);
      const result = await claimHybridRoi();
      showToast(`ROI claimed: $${Number(result?.amount || 0).toFixed(2)}`);
      await loadUser(true);
    } catch (err: any) {
      showToast(getApiErrorMessage(err, "Failed to claim ROI ❌"));
    } finally {
      setRoiLoading(false);
    }
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
    <div className="min-h-screen max-w-[420px] mx-auto px-4 pb-28 text-white relative overflow-hidden">
      <AppToast message={toast} />

      {/* HEADER */}
      <div className="flex justify-between items-center pt-5 relative z-10">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-purple-300/70">
            VIP Ultra
          </p>
          <h1 className="font-black text-2xl bg-gradient-to-r from-purple-300 via-fuchsia-300 to-blue-300 bg-clip-text text-transparent">
            NovaCentral
          </h1>
        </div>

        <button
          onClick={logout}
          className="text-xs text-red-300 bg-red-500/10 border border-red-400/20 rounded-full px-4 py-2 hover:bg-red-500/20 transition-all duration-300"
        >
          Logout
        </button>
      </div>

      {/* PROFILE */}
      <div className="flex items-center gap-3 mt-6 bg-white/[0.05] border border-white/10 rounded-2xl p-3 backdrop-blur-2xl shadow-[0_18px_55px_rgba(0,0,0,0.35)]">
        <div className="p-[2px] rounded-full bg-gradient-to-br from-purple-400 via-fuchsia-400 to-blue-400 shadow-[0_0_25px_rgba(168,85,247,0.45)]">
          <Image
            src="/logo.png"
            alt="user"
            width={55}
            height={55}
            className="rounded-full bg-black"
          />
        </div>

        <div className="min-w-0">
          <p className="text-gray-400 text-xs uppercase tracking-[0.18em]">Welcome Back</p>
          <h2 className="font-bold text-lg truncate">{user?.username}</h2>
          <p className="text-[11px] text-gray-500">
            VIP ID: {user?._id?.slice(0, 6)}
          </p>
        </div>
      </div>

      {/* BALANCE */}
      <div className="mt-6 p-[1px] rounded-3xl bg-gradient-to-br from-purple-400 via-fuchsia-500 to-blue-500 shadow-[0_0_55px_rgba(124,58,237,0.45)]">
        <div className="bg-[#08080d]/90 p-5 rounded-3xl backdrop-blur-2xl">
        <p className="text-xs text-gray-400 uppercase tracking-[0.22em]">Total Balance</p>

        <h1 className="text-4xl font-black text-white mt-2 text-glow">
          ${displayBalance.toFixed(2)}
        </h1>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <MiniMetric title="Total Earnings" value={user?.totalEarnings} />
          <MiniMetric title="ROI Today" value={user?.todayProfit} />
        </div>

        {cooldown > 0 && (
          <p className="text-xs text-yellow-400 mt-2">
            ⏳ Withdraw in {formatTime(cooldown)}
          </p>
        )}
        </div>
      </div>

      {/* 🔥 ACTION BUTTONS (FIXED) */}
      <div className="grid grid-cols-3 gap-3 mt-6">
        <Action label="Deposit" icon="↓" onClick={() => router.push("/deposit")} />
        <Action label="Withdraw" icon="↑" onClick={() => router.push("/withdrawal")} />
        <Action label="Invest" icon="◆" onClick={() => router.push("/investment")} />
      </div>

      <div className="mt-6 p-[1px] rounded-3xl bg-gradient-to-r from-cyan-500/60 via-purple-500/70 to-fuchsia-500/70 shadow-[0_0_35px_rgba(124,58,237,0.25)]">
        <div className="bg-[#08080d]/90 p-5 rounded-3xl backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-200/80">
                HybridEarn
              </p>
              <h3 className="mt-1 text-lg font-black text-white">ROI Wallet</h3>
            </div>
            <span className="rounded-full border border-purple-300/20 bg-purple-500/10 px-3 py-1 text-[10px] font-semibold text-purple-100">
              Level {Number(hybrid?.level || 0)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <MiniMetric title="Deposit Balance" value={hybrid?.depositBalance} />
            <MiniMetric title="Reward Balance" value={hybrid?.rewardBalance} />
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-gray-400">Current ROI Rate</p>
                <p className="mt-1 text-sm font-bold text-cyan-300">
                  {(Number(hybrid?.roiRate || 0) * 100).toFixed(2)}% daily
                </p>
              </div>
              <button
                onClick={handleClaimRoi}
                disabled={roiLoading || Number(hybrid?.roiRate || 0) <= 0 || roiCooldownMs > 0}
                className="rounded-xl bg-gradient-to-r from-[#7c3aed] via-[#a855f7] to-[#4f46e5] px-4 py-3 text-xs font-bold shadow-[0_0_24px_rgba(124,58,237,0.45)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {roiLoading ? "Claiming..." : "Claim ROI"}
              </button>
            </div>

            <p className="mt-3 text-[11px] text-gray-400">
              {roiCooldownMs > 0
                ? `Next claim in ${Math.ceil(roiCooldownMs / (60 * 60 * 1000))}h`
                : "ROI can be claimed once every 24 hours."}
            </p>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 gap-3 mt-6">
        <Stat title="Earnings" value={user?.totalEarnings} />
        <Stat title="Today" value={user?.todayProfit} />
        <Stat title="Invested" value={user?.totalInvested} />
        <Stat title="Withdrawn" value={user?.totalWithdraw} />
      </div>

      {/* RECENT ACTIVITY */}
      <div className="mt-6 bg-white/[0.05] border border-white/10 rounded-2xl p-4 backdrop-blur-2xl shadow-[0_18px_55px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-purple-300/80">Recent Activity</p>
            <h3 className="font-bold text-lg">Account Pulse</h3>
          </div>
          <span className="text-[10px] rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1 text-green-300">
            Live
          </span>
        </div>
        <div className="space-y-3">
          <Activity title="Balance Updated" value={`$${displayBalance.toFixed(2)}`} />
          <Activity title="Today ROI" value={`$${Number(user?.todayProfit || 0).toFixed(2)}`} />
          <Activity title="Total Invested" value={`$${Number(user?.totalInvested || 0).toFixed(2)}`} />
        </div>
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
      className="bg-white/[0.06] border border-white/10 rounded-2xl p-3 text-center active:scale-95 hover:scale-105 hover:border-purple-300/40 hover:bg-purple-500/15 hover:shadow-[0_0_28px_rgba(124,58,237,0.28)] transition-all duration-300 backdrop-blur-xl"
    >
      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 text-lg font-black shadow-[0_0_25px_rgba(124,58,237,0.45)]">{icon}</div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">{label}</p>
    </button>
  );
}

/* 📊 STAT */
function Stat({ title, value }: any) {
  return (
    <div className="bg-white/[0.06] border border-white/10 p-4 rounded-2xl backdrop-blur-xl hover:scale-[1.02] hover:border-blue-300/30 transition-all duration-300">
      <p className="text-[10px] text-gray-400 uppercase tracking-[0.18em]">{title}</p>
      <h4 className="text-base font-bold text-cyan-300 mt-1">
        ${Number(value || 0).toFixed(2)}
      </h4>
    </div>
  );
}

function MiniMetric({ title, value }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
      <p className="text-[10px] text-gray-400">{title}</p>
      <p className="text-sm font-bold text-purple-200">${Number(value || 0).toFixed(2)}</p>
    </div>
  );
}

function Activity({ title, value }: any) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-3">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full bg-purple-400 shadow-[0_0_18px_rgba(168,85,247,0.8)]" />
        <p className="text-xs text-gray-300">{title}</p>
      </div>
      <p className="text-xs font-bold text-white">{value}</p>
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