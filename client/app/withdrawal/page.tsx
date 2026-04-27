"use client";

import { useState, useEffect } from "react";
import { getApiErrorMessage } from "../../lib/api";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import ProtectedRoute from "../../components/ProtectedRoute";
import AppToast from "../../components/AppToast";
import { fetchCurrentUser } from "../../lib/session";
import GradientButton from "../../components/GradientButton";
import CountdownTimer from "../../components/CountdownTimer";
import GlassCard from "../../components/GlassCard";
import { fetchHybridSummary, fetchHybridWithdrawals, requestHybridWithdraw } from "../../lib/hybrid";

export default function Withdrawal() {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser]: any = useState(null);
  const [toast, setToast] = useState("");
  const [hybrid, setHybrid]: any = useState(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const spendableHybridBalance =
    Number(hybrid?.depositBalance || 0) + Number(hybrid?.rewardBalance || 0);

  const loadHybrid = async () => {
    const [hybridData, withdrawalData] = await Promise.all([
      fetchHybridSummary().catch(() => null),
      fetchHybridWithdrawals().catch(() => []),
    ]);
    setHybrid(hybridData);
    setWithdrawals(withdrawalData || []);
  };

  const pendingWithdrawal = withdrawals.find((item) => item.status === "pending") || null;
  const latestWithdrawal = withdrawals[0] || null;
  const cooldownTarget = latestWithdrawal?.createdAt
    ? new Date(latestWithdrawal.createdAt).getTime() + 96 * 60 * 60 * 1000
    : 0;

  // 🔐 USER LOAD
  useEffect(() => {
    Promise.all([fetchCurrentUser(), loadHybrid()]).then(([fresh]) => {
      if (fresh) {
        setUser(fresh);
        setWalletAddress(fresh.walletAddress || "");
      }
    });
  }, []);

  // 🚀 WITHDRAW
  const withdraw = async () => {
    if (loading) return;

    const amt = Number(amount);

    if (!Number.isFinite(amt) || amt < 30) {
      return showToast("Minimum withdraw amount is $30");
    }

    if (amt > spendableHybridBalance) {
      return showToast("Insufficient Hybrid balance");
    }

    if (!walletAddress.trim()) {
      return showToast("Wallet address is required");
    }

    if (!password.trim()) {
      return showToast("Password is required");
    }

    if (!otp.trim()) {
      return showToast("OTP is required");
    }

    try {
      setLoading(true);
      await requestHybridWithdraw(
        {
          amount: amt,
          walletAddress: walletAddress.trim(),
          password,
          otp: otp.trim(),
        },
        globalThis.crypto?.randomUUID?.()
      );

      showToast("Hybrid withdrawal requested");
      setAmount("");
      setPassword("");
      setOtp("");
      await loadHybrid();

    } catch (err: any) {
      showToast(getApiErrorMessage(err, "Failed ❌"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
    <div className="min-h-screen max-w-[420px] mx-auto px-4 py-6 text-white relative bg-[#040406]">
      <AppToast message={toast} />

      {/* 🌌 BACKGROUND */}
      <div className="absolute w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[150px] top-[-150px] left-[-150px]" />
      <div className="absolute w-[500px] h-[500px] bg-indigo-600 opacity-20 blur-[150px] bottom-[-150px] right-[-150px]" />

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 relative z-10">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-purple-300/70">Secure Payout</p>
          <h1 className="text-2xl font-black bg-gradient-to-r from-purple-300 via-fuchsia-300 to-blue-300 bg-clip-text text-transparent">
            HybridEarn Withdraw
          </h1>
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-purple-300 bg-white/[0.06] border border-white/10 rounded-full px-4 py-2 hover:bg-purple-500/15 transition-all duration-300"
        >
          Back
        </button>
      </div>

      <div className="bg-gradient-to-br from-purple-500/20 via-indigo-500/10 to-blue-500/10 p-5 rounded-3xl border border-purple-300/30 text-center mb-4 backdrop-blur-2xl shadow-[0_0_45px_rgba(124,58,237,0.28)]">
        <p className="text-xs text-gray-400 uppercase tracking-[0.22em]">Available Balance</p>
        <h2 className="text-4xl font-black text-white text-glow">
          ${spendableHybridBalance.toFixed(2)}
        </h2>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Pending Status</p>
          <p className="mt-1 text-sm font-black text-yellow-200">
            {pendingWithdrawal ? `$${Number(pendingWithdrawal.amount || 0).toFixed(2)} Pending` : "No Pending"}
          </p>
        </div>
        <CountdownTimer
          targetTime={cooldownTarget ? new Date(cooldownTarget).toISOString() : null}
          label="96h Timer"
          completeText={latestWithdrawal ? "Window Complete" : "No Cooldown"}
          className="p-4"
        />
      </div>

      {/* MAIN CARD */}
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
        <GlassCard glow="purple">
          <div className="mb-4">
            <p className="text-sm font-semibold text-white">Withdraw USDT</p>
            <p className="mt-1 text-xs text-gray-400">
              Enter your payout details and security verification.
            </p>
          </div>

          <input
            type="number"
            placeholder="Enter Amount ($30 minimum)"
            value={amount}
            disabled={loading}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-white/[0.06] border border-white/10 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/25 focus:shadow-[0_0_28px_rgba(124,58,237,0.3)] outline-none p-3 rounded-xl text-sm transition-all duration-300 placeholder:text-gray-600"
          />

          <input
            type="text"
            placeholder="Wallet Address"
            value={walletAddress}
            disabled={loading}
            onChange={(e) => setWalletAddress(e.target.value)}
            className="w-full mt-3 bg-white/[0.06] border border-white/10 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/25 focus:shadow-[0_0_28px_rgba(124,58,237,0.3)] outline-none p-3 rounded-xl text-sm transition-all duration-300 placeholder:text-gray-600"
          />

          <input
            type="password"
            placeholder="Enter password"
            value={password}
            disabled={loading}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mt-3 bg-white/[0.06] border border-white/10 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/25 focus:shadow-[0_0_28px_rgba(124,58,237,0.3)] outline-none p-3 rounded-xl text-sm transition-all duration-300 placeholder:text-gray-600"
          />

          <input
            type="text"
            placeholder="Email OTP"
            value={otp}
            disabled={loading}
            onChange={(e) => setOtp(e.target.value)}
            className="w-full mt-3 bg-white/[0.06] border border-white/10 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/25 focus:shadow-[0_0_28px_rgba(124,58,237,0.3)] outline-none p-3 rounded-xl text-sm transition-all duration-300 placeholder:text-gray-600"
          />

          {/* BUTTON */}
          <GradientButton
            onClick={withdraw}
            disabled={loading}
            loading={loading}
            className="mt-5"
          >
            {loading ? "Processing..." : "Withdraw"}
          </GradientButton>

        </GlassCard>
      </motion.div>

      {/* INFO */}
      <div className="mt-5 bg-white/[0.06] p-4 rounded-2xl border border-white/10 text-sm backdrop-blur-2xl">
        <p className="text-yellow-300 font-semibold mb-2">Important</p>

        <ul className="space-y-1 text-gray-400 text-xs">
          <li>Minimum withdraw: $30</li>
          <li>Processing time: 24-96 hours</li>
          <li>Cooldown: 96 hours after each withdraw</li>
          <li>Ensure correct wallet address</li>
        </ul>
      </div>

    </div>
    </ProtectedRoute>
  );
}