"use client";

import { useState, useEffect, useRef } from "react";
import { getApiErrorMessage } from "../../lib/api";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import ProtectedRoute from "../../components/ProtectedRoute";
import AppToast from "../../components/AppToast";
import { fetchCurrentUser } from "../../lib/session";
import GradientButton from "../../components/GradientButton";
import {
  claimHybridWithdraw,
  fetchHybridSummary,
  fetchHybridWithdrawals,
  requestHybridWithdraw,
} from "../../lib/hybrid";

export default function Withdrawal() {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser]: any = useState(null);
  const [toast, setToast] = useState("");
  const [hybrid, setHybrid]: any = useState(null);
  const [hybridWithdrawals, setHybridWithdrawals] = useState<any[]>([]);
  const [hybridAmount, setHybridAmount] = useState("");
  const [hybridWalletAddress, setHybridWalletAddress] = useState("");
  const [hybridLoading, setHybridLoading] = useState(false);
  const idempotencyKeyRef = useRef("");
  const hybridIdempotencyKeyRef = useRef("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const createIdempotencyKey = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  const getSubmissionIdempotencyKey = () => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = createIdempotencyKey();
    }
    return idempotencyKeyRef.current;
  };

  const resetSubmissionIdempotencyKey = () => {
    idempotencyKeyRef.current = "";
  };

  const getHybridIdempotencyKey = () => {
    if (!hybridIdempotencyKeyRef.current) {
      hybridIdempotencyKeyRef.current = createIdempotencyKey();
    }
    return hybridIdempotencyKeyRef.current;
  };

  const resetHybridIdempotencyKey = () => {
    hybridIdempotencyKeyRef.current = "";
  };

  const spendableHybridBalance =
    Number(hybrid?.depositBalance || 0) + Number(hybrid?.rewardBalance || 0);

  const formatCountdown = (availableAt: string) => {
    const remaining = Math.max(0, new Date(availableAt).getTime() - Date.now());
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining / (1000 * 60)) % 60);
    return remaining > 0 ? `${hours}h ${minutes}m remaining` : "Ready to claim";
  };

  const loadHybrid = async () => {
    const [hybridData, withdrawals] = await Promise.all([
      fetchHybridSummary().catch(() => null),
      fetchHybridWithdrawals().catch(() => []),
    ]);

    setHybrid(hybridData);
    setHybridWithdrawals(withdrawals || []);
  };

  // 🔐 USER LOAD
  useEffect(() => {
    Promise.all([fetchCurrentUser(), loadHybrid()]).then(([fresh]) => {
      if (fresh) {
        setUser(fresh);
        setWalletAddress(fresh.walletAddress || "");
        setHybridWalletAddress(fresh.walletAddress || "");
      }
    });
  }, []);

  // 🚀 WITHDRAW
  const withdraw = async () => {
    if (loading) return;

    const amt = Number(amount);

    if (!Number.isFinite(amt) || amt <= 0) {
      return showToast("Amount must be greater than 0");
    }

    if (amt > spendableHybridBalance) {
      return showToast("Insufficient Hybrid balance");
    }

    if (!walletAddress || walletAddress.trim().length < 8) {
      return showToast("Enter a valid wallet address");
    }

    try {
      setLoading(true);
      await requestHybridWithdraw(
        {
          amount: amt,
          walletAddress: walletAddress.trim(),
        },
        getSubmissionIdempotencyKey()
      );

      showToast("Hybrid withdrawal requested");
      setAmount("");
      resetSubmissionIdempotencyKey();
      await loadHybrid();

    } catch (err: any) {
      showToast(getApiErrorMessage(err, "Failed ❌"));
    } finally {
      setLoading(false);
    }
  };

  const requestHybrid = async () => {
    if (hybridLoading) return;

    const amt = Number(hybridAmount);

    if (!Number.isFinite(amt) || amt <= 0) {
      return showToast("Amount must be greater than 0");
    }

    if (!hybridWalletAddress || hybridWalletAddress.trim().length < 8) {
      return showToast("Enter a valid wallet address");
    }

    try {
      setHybridLoading(true);
      await requestHybridWithdraw(
        {
          amount: amt,
          walletAddress: hybridWalletAddress.trim(),
        },
        getHybridIdempotencyKey()
      );
      showToast("Hybrid withdrawal requested");
      setHybridAmount("");
      resetHybridIdempotencyKey();
      await loadHybrid();
    } catch (err: any) {
      showToast(getApiErrorMessage(err, "Hybrid withdraw failed ❌"));
    } finally {
      setHybridLoading(false);
    }
  };

  const claimHybrid = async (withdrawalId: string) => {
    try {
      setHybridLoading(true);
      await claimHybridWithdraw(withdrawalId);
      showToast("Hybrid withdrawal claimed");
      await loadHybrid();
    } catch (err: any) {
      showToast(getApiErrorMessage(err, "Claim failed ❌"));
    } finally {
      setHybridLoading(false);
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

      {/* BALANCE */}
      <div className="bg-gradient-to-br from-purple-500/20 via-indigo-500/10 to-blue-500/10 p-5 rounded-3xl border border-purple-300/30 text-center mb-6 backdrop-blur-2xl shadow-[0_0_45px_rgba(124,58,237,0.28)]">
        <p className="text-xs text-gray-400 uppercase tracking-[0.22em]">Available Balance</p>
        <h2 className="text-4xl font-black text-white text-glow">
          ${spendableHybridBalance.toFixed(2)}
        </h2>
      </div>

      {/* MAIN CARD */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-[1px] rounded-3xl bg-gradient-to-r from-purple-500 via-fuchsia-500 to-indigo-500 shadow-[0_0_45px_rgba(124,58,237,0.35)]"
      >
        <div className="bg-[#08080d]/90 backdrop-blur-2xl p-5 rounded-3xl">

          {/* QUICK BUTTONS */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[10, 50, 100].map((val) => (
              <button
                key={val}
                disabled={loading}
                onClick={() => {
                  resetSubmissionIdempotencyKey();
                  setAmount(String(val));
                }}
                className="bg-white/[0.06] border border-white/10 p-2 rounded-xl text-xs hover:scale-105 hover:bg-purple-500/20 hover:border-purple-300/30 transition-all duration-300"
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
            disabled={loading}
            onChange={(e) => {
              resetSubmissionIdempotencyKey();
              setAmount(e.target.value);
            }}
            className="w-full bg-white/[0.06] border border-white/10 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/25 focus:shadow-[0_0_28px_rgba(124,58,237,0.3)] outline-none p-3 rounded-xl text-sm transition-all duration-300 placeholder:text-gray-600"
          />

          <input
            type="text"
            placeholder="Wallet Address"
            value={walletAddress}
            disabled={loading}
            onChange={(e) => {
              resetSubmissionIdempotencyKey();
              setWalletAddress(e.target.value);
            }}
            className="w-full mt-3 bg-white/[0.06] border border-white/10 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/25 focus:shadow-[0_0_28px_rgba(124,58,237,0.3)] outline-none p-3 rounded-xl text-sm transition-all duration-300 placeholder:text-gray-600"
          />

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Cooldown Window</span>
              <span className="font-semibold text-purple-200">96h</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-blue-500 shadow-[0_0_18px_rgba(168,85,247,0.7)]" />
            </div>
          </div>

          {/* BUTTON */}
          <GradientButton
            onClick={withdraw}
            disabled={loading}
            loading={loading}
            className="mt-5"
          >
            {loading ? "Processing..." : "Withdraw"}
          </GradientButton>

        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-5 p-[1px] rounded-3xl bg-gradient-to-r from-cyan-500 via-purple-500 to-fuchsia-500 shadow-[0_0_45px_rgba(124,58,237,0.2)]"
      >
        <div className="bg-[#08080d]/90 backdrop-blur-2xl p-5 rounded-3xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-200/80">
                HybridEarn
              </p>
              <h3 className="mt-1 text-lg font-black text-white">Pending Withdraw</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-semibold text-purple-100">
              Level {Number(hybrid?.level || 0)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
              <p className="text-[10px] text-gray-400">Reward Balance</p>
              <p className="text-sm font-bold text-purple-200">
                ${Number(hybrid?.rewardBalance || 0).toFixed(2)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
              <p className="text-[10px] text-gray-400">Pending Withdraw</p>
              <p className="text-sm font-bold text-purple-200">
                ${Number(hybrid?.pendingWithdraw || 0).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200">96h Countdown</p>
            <p className="mt-1 text-xs text-gray-300">
              Pending withdrawals unlock after the protected 96h window.
            </p>
          </div>

          <input
            type="number"
            placeholder="Hybrid amount"
            value={hybridAmount}
            disabled={hybridLoading}
            onChange={(e) => {
              resetHybridIdempotencyKey();
              setHybridAmount(e.target.value);
            }}
            className="w-full mt-4 bg-white/[0.06] border border-white/10 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/25 outline-none p-3 rounded-xl text-sm placeholder:text-gray-600"
          />

          <input
            type="text"
            placeholder="Hybrid payout wallet"
            value={hybridWalletAddress}
            disabled={hybridLoading}
            onChange={(e) => {
              resetHybridIdempotencyKey();
              setHybridWalletAddress(e.target.value);
            }}
            className="w-full mt-3 bg-white/[0.06] border border-white/10 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/25 outline-none p-3 rounded-xl text-sm placeholder:text-gray-600"
          />

          <GradientButton
            onClick={requestHybrid}
            disabled={hybridLoading}
            loading={hybridLoading}
            className="mt-5 bg-gradient-to-r from-[#0891b2] via-[#7c3aed] to-[#d946ef]"
          >
            {hybridLoading ? "Processing..." : "Request Hybrid Withdrawal"}
          </GradientButton>

          <div className="mt-4 space-y-2">
            {hybridWithdrawals.slice(0, 3).map((item: any) => (
              <div
                key={item._id}
                className="rounded-2xl border border-white/10 bg-black/30 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-white">
                      ${Number(item.netAmount || 0).toFixed(2)} net
                    </p>
                    <p className="text-[10px] text-gray-500">
                      Status: {item.status} | Fee: ${Number(item.feeAmount || 0).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-cyan-300">
                      96h countdown: {item.availableAt ? formatCountdown(item.availableAt) : "Pending"}
                    </p>
                  </div>
                  {(item.status === "claimable" ||
                    (item.status === "pending" &&
                      new Date(item.availableAt).getTime() <= Date.now())) && (
                    <button
                      onClick={() => claimHybrid(item._id)}
                      disabled={hybridLoading}
                      className="rounded-xl border border-green-300/20 bg-green-500/10 px-3 py-2 text-[10px] font-bold text-green-200"
                    >
                      Claim
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!hybridWithdrawals.length && (
              <p className="text-xs text-gray-500">No Hybrid withdrawals yet.</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* INFO */}
      <div className="mt-5 bg-white/[0.06] p-4 rounded-2xl border border-white/10 text-sm backdrop-blur-2xl">
        <p className="text-yellow-300 font-semibold mb-2">Important</p>

        <ul className="space-y-1 text-gray-400 text-xs">
          <li>Minimum withdraw: $10</li>
          <li>Processing time: 24-96 hours</li>
          <li>Cooldown: 96 hours after each withdraw</li>
          <li>Ensure correct wallet address</li>
        </ul>
      </div>

    </div>
    </ProtectedRoute>
  );
}