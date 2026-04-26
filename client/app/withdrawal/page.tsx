"use client";

import { useState, useEffect, useRef } from "react";
import API, { getApiErrorMessage } from "../../lib/api";
import { getUser } from "../../lib/auth";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import ProtectedRoute from "../../components/ProtectedRoute";
import AppToast from "../../components/AppToast";
import { fetchCurrentUser } from "../../lib/session";

export default function Withdrawal() {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser]: any = useState(null);
  const [toast, setToast] = useState("");
  const idempotencyKeyRef = useRef("");

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

  // 🔐 USER LOAD
  useEffect(() => {
    const cached = getUser();
    if (cached) setUser(cached);
    fetchCurrentUser().then((fresh) => {
      if (fresh) setUser(fresh);
    });
  }, []);

  // 🚀 WITHDRAW
  const withdraw = async () => {
    if (loading) return;

    const amt = Number(amount);

    if (!Number.isFinite(amt) || amt <= 0) {
      return showToast("Amount must be greater than 0");
    }

    if (amt > (user?.balance || 0)) {
      return showToast("Insufficient balance");
    }

    if (!walletAddress || walletAddress.trim().length < 8) {
      return showToast("Enter a valid wallet address");
    }

    try {
      setLoading(true);
      const idempotencyKey = getSubmissionIdempotencyKey();

      const res = await API.post(
        "/withdrawal",
        {
          amount: amt,
          walletAddress: walletAddress.trim(),
        },
        {
          headers: { "Idempotency-Key": idempotencyKey },
        }
      );

      showToast(res?.data?.msg || "Withdrawal requested");
      resetSubmissionIdempotencyKey();

      router.push("/dashboard");

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
            disabled={loading}
            onChange={(e) => {
              resetSubmissionIdempotencyKey();
              setAmount(e.target.value);
            }}
            className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-sm"
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
            className="w-full mt-3 bg-white/5 border border-white/10 p-3 rounded-xl text-sm"
          />

          {/* BUTTON */}
          <button
            onClick={withdraw}
            disabled={loading}
            className="mt-4 w-full bg-gradient-to-r from-purple-500 to-indigo-500 p-3 rounded-xl font-semibold flex justify-center items-center gap-2"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {loading ? "Processing..." : "Withdraw 🚀"}
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
    </ProtectedRoute>
  );
}