"use client";

import { getUser, logout } from "../../lib/auth";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";

export default function Profile() {
  const router = useRouter();
  const user = getUser();

  return (
    <div className="min-h-screen max-w-[420px] mx-auto px-4 py-6 text-white relative bg-[#040406]">

      {/* 🌌 BACKGROUND */}
      <div className="absolute w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[150px] top-[-150px] left-[-150px]" />
      <div className="absolute w-[500px] h-[500px] bg-indigo-600 opacity-20 blur-[150px] bottom-[-150px] right-[-150px]" />

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 relative z-10">
        <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
          Profile 👤
        </h1>

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
        className="p-[1px] rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500"
      >
        <div className="bg-[#0b0b0f] p-5 rounded-2xl text-center">

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

          {/* ID */}
          <p className="text-[11px] text-gray-500 mt-1">
            ID: {user?._id?.slice(0, 6)}
          </p>

        </div>
      </motion.div>

      {/* ACCOUNT INFO */}
      <div className="mt-5 bg-white/5 p-4 rounded-2xl border border-white/10">

        <h3 className="text-sm font-semibold mb-3 text-gray-300">
          Account Info
        </h3>

        <div className="space-y-2 text-sm text-gray-400">
          <p>👤 Username: {user?.username}</p>
          <p>📧 Email: {user?.email}</p>
          <p>📱 Phone: {user?.number || "Not added"}</p>
          <p>🎯 Referral: {user?.referralCode || "N/A"}</p>
        </div>

      </div>

      {/* ACTIONS */}
      <div className="mt-5 space-y-3">

        <button
          onClick={() => router.push("/deposit")}
          className="w-full bg-white/5 p-3 rounded-xl border border-white/10 text-sm hover:bg-purple-500/20"
        >
          💰 Deposit
        </button>

        <button
          onClick={() => router.push("/withdrawal")}
          className="w-full bg-white/5 p-3 rounded-xl border border-white/10 text-sm hover:bg-purple-500/20"
        >
          💸 Withdraw
        </button>

        <button
          onClick={() => router.push("/referral")}
          className="w-full bg-white/5 p-3 rounded-xl border border-white/10 text-sm hover:bg-purple-500/20"
        >
          👥 Referral Team
        </button>

      </div>

      {/* LOGOUT */}
      <button
        onClick={logout}
        className="mt-6 w-full bg-red-500/20 text-red-400 p-3 rounded-xl font-semibold hover:bg-red-500/30 transition"
      >
        Logout 🚪
      </button>

    </div>
  );
}