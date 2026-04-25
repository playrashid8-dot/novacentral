"use client";

import { useState, useEffect } from "react";
import API from "../../lib/api";
import { getUser } from "../../lib/auth";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function Withdrawal() {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [user, setUser]: any = useState(null);

  // 🔐 USER LOAD
  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);
  }, []);

  // ⏱️ LOAD COOLDOWN
  useEffect(() => {
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

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  };

  // 🚀 WITHDRAW
  const withdraw = async () => {
    if (loading) return;

    const amt = Number(amount);

    if (!amt || amt < 10) {
      return alert("Minimum withdraw is $10");
    }

    if (amt > (user?.balance || 0)) {
      return alert("Insufficient balance");
    }

    if (cooldown > 0) {
      return alert("Withdrawal locked ⏳");
    }

    try {
      setLoading(true);

      await API.post("/withdraw", { amount: amt });

      alert("Withdrawal requested ✅");

      // 🔒 SAVE TIME
      localStorage.setItem("withdrawTime", Date.now().toString());

      router.push("/dashboard");

    } catch (err: any) {
      alert(err?.response?.data?.msg || "Failed ❌");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen max-w-[420px] mx-auto px-4 py-6 text-white relative bg-[#040406]">

      {/* 🌌 BACKGROUND */}
      <div className="absolute w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[150px] top-[-150px] left-[-150px]" />
      <div className="absolute w-[500px] h-[500px] bg-indigo-600 opacity-20 blur-[150px] bottom-[-150px] right-[-150px]" />

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 relative z-10">
        <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
          Withdraw 💸
        </h1>

        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-purple-400"
        >
          Back
        </button>
      </div>

      {/* BALANCE */}
      <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center mb-6">
        <p className="text-xs text-gray-400">Available Balance</p>
        <h2 className="text-3xl font-bold text-green-400">
          ${Number(user?.balance || 0).toFixed(2)}
        </h2>
      </div>

      {/* MAIN CARD */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-[1px] rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500"
      >
        <div className="bg-[#0b0b0f] p-5 rounded-2xl">

          {/* COOLDOWN */}
          {cooldown > 0 && (
            <div className="mb-3 text-xs text-yellow-400">
              ⏳ Next withdrawal in {formatTime(cooldown)}
            </div>
          )}

          {/* QUICK BUTTONS */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[10, 50, 100].map((val) => (
              <button
                key={val}
                onClick={() => setAmount(String(val))}
                className="bg-white/5 p-2 rounded-lg text-xs"
              >
                ${val}
              </button>
            ))}
          </div>

          {/* INPUT */}
          <input
            type="number"
            placeholder="Enter Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-sm"
          />

          {/* BUTTON */}
          <button
            onClick={withdraw}
            disabled={loading || cooldown > 0}
            className="mt-4 w-full bg-gradient-to-r from-purple-500 to-indigo-500 p-3 rounded-xl font-semibold flex justify-center items-center gap-2"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {cooldown > 0
              ? "Locked ⏳"
              : loading
              ? "Processing..."
              : "Withdraw 🚀"}
          </button>

        </div>
      </motion.div>

      {/* INFO */}
      <div className="mt-5 bg-white/5 p-4 rounded-2xl border border-white/10 text-sm">
        <p className="text-yellow-400 font-semibold mb-2">⚠️ Important</p>

        <ul className="space-y-1 text-gray-400 text-xs">
          <li>• Minimum withdraw: $10</li>
          <li>• Processing time: 24–96 hours</li>
          <li>• Cooldown: 96 hours after each withdraw</li>
          <li>• Ensure correct wallet address</li>
        </ul>
      </div>

    </div>
  );
}