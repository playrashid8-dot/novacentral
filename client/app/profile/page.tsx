"use client";

import { logout } from "../../lib/auth";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import ProtectedRoute from "../../components/ProtectedRoute";
import { fetchCurrentUser } from "../../lib/session";
import { fetchHybridSummary } from "../../lib/hybrid";
import BottomNav from "../../components/BottomNav";
import GlassCard from "../../components/GlassCard";
import StatCard from "../../components/StatCard";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import { maskAddress } from "../../lib/helpers";

export default function Profile() {
  const router = useRouter();
  const [user, setUser]: any = useState(null);
  const [hybrid, setHybrid]: any = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchCurrentUser(), fetchHybridSummary().catch(() => null)])
      .then(([fresh, hybridData]) => {
        if (fresh) setUser(fresh);
        if (hybridData) setHybrid(hybridData);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <ProtectedRoute>
        <Loader />
      </ProtectedRoute>
    );
  }

  if (!user?._id) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen max-w-[420px] mx-auto px-4 py-10 flex flex-col items-center justify-center bg-[#040406]">
          <EmptyState text="No data available" />
        </div>
      </ProtectedRoute>
    );
  }

  const walletDisplayRaw = hybrid?.walletAddress || user?.walletAddress || "";
  const walletMasked = walletDisplayRaw ? maskAddress(walletDisplayRaw) : "Generating wallet";

  return (
    <ProtectedRoute>
    <div className="min-h-screen max-w-[420px] mx-auto px-4 py-6 pb-28 text-white relative bg-[#040406] overflow-x-hidden">

      {/* 🌌 BACKGROUND */}
      <div className="absolute w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[150px] top-[-150px] left-[-150px]" />
      <div className="absolute w-[500px] h-[500px] bg-indigo-600 opacity-20 blur-[150px] bottom-[-150px] right-[-150px]" />

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 relative z-10">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-purple-300/70">Account Center</p>
          <h1 className="text-2xl font-black bg-gradient-to-r from-purple-300 via-fuchsia-300 to-blue-300 bg-clip-text text-transparent">
            HybridEarn Profile
          </h1>
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-purple-400"
        >
          Back
        </button>
      </div>

      {/* PROFILE CARD */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-[1px] rounded-3xl bg-gradient-to-r from-purple-500 via-fuchsia-500 to-indigo-500 shadow-[0_0_50px_rgba(124,58,237,0.32)]"
      >
        <div className="bg-[#0b0b0f]/95 p-5 rounded-3xl text-center backdrop-blur-2xl">

          {/* AVATAR */}
          <div className="flex justify-center mb-3">
            <div className="p-[2px] rounded-full bg-gradient-to-r from-purple-500 to-cyan-500">
              <Image
                src="/logo.png"
                alt="user"
                width={70}
                height={70}
                className="rounded-full bg-black"
              />
            </div>
          </div>

          {/* NAME */}
          <h2 className="font-bold text-lg">{user?.username}</h2>
          <p className="text-xs text-gray-400">{user?.email}</p>
          <span className="mt-3 inline-flex rounded-full border border-purple-300/20 bg-purple-500/10 px-4 py-1 text-xs font-bold text-purple-100">
            VIP {Number(hybrid?.level || user?.level || 0)}
          </span>

          {/* ID */}
          <p className="text-[11px] text-gray-500 mt-1">
            ID: {user?._id?.slice(0, 6)}
          </p>

        </div>
      </motion.div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <StatCard title="Deposit" value={`$${Number(hybrid?.depositBalance ?? 0).toFixed(2)}`} tone="purple" />
        <StatCard title="Rewards" value={`$${Number(hybrid?.rewardBalance ?? 0).toFixed(2)}`} tone="cyan" />
      </div>

      <GlassCard glow="cyan" className="mt-5">
        <h3 className="text-sm font-semibold mb-3 text-gray-200">Account Info</h3>
        <div className="space-y-3 text-sm">
          <Info label="Username" value={user?.username || "-"} />
          <Info label="Email" value={user?.email || "-"} />
          <Info label="Wallet Address" value={walletMasked} />
          <Info label="Level" value={`VIP ${Number(hybrid?.level || user?.level || 0)}`} />
          <Info label="Referral Code" value={user?.referralCode || "N/A"} />
        </div>
      </GlassCard>

      <GlassCard glow="gold" className="mt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-yellow-200/80">Security Info</p>
            <h3 className="mt-1 text-lg font-black">Password Protection</h3>
          </div>
          <span className="rounded-full border border-green-300/20 bg-green-400/10 px-3 py-1 text-[10px] font-bold text-green-200">
            Cookies
          </span>
        </div>
        <p className="mt-3 text-xs leading-5 text-gray-400">
          Authentication is handled with httpOnly cookies. No auth token is stored in localStorage.
        </p>
        <button
          disabled
          className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold text-gray-500"
        >
          Change Password API Not Available
        </button>
      </GlassCard>

      {/* ACTIONS */}
      <div className="mt-5 space-y-3">

        <button
          onClick={() => router.push("/deposit")}
          className="w-full rounded-xl bg-white/5 p-3 border border-white/10 text-sm hover:bg-purple-500/20 transition"
        >
          Deposit
        </button>

        <button
          onClick={() => router.push("/withdrawal")}
          className="w-full bg-white/5 p-3 rounded-xl border border-white/10 text-sm hover:bg-purple-500/20"
        >
          Withdraw
        </button>

        <button
          onClick={() => router.push("/referral")}
          className="w-full bg-white/5 p-3 rounded-xl border border-white/10 text-sm hover:bg-purple-500/20"
        >
          Referral Team
        </button>

      </div>

      {/* LOGOUT */}
      <button
        onClick={logout}
        className="mt-6 w-full bg-red-500/20 text-red-400 p-3 rounded-xl font-semibold hover:bg-red-500/30 transition"
      >
        Logout
      </button>

      <BottomNav />

    </div>
    </ProtectedRoute>
  );
}

function Info({ label, value }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className="mt-1 break-all text-sm font-semibold text-white">{value}</p>
    </div>
  );
}