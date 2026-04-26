"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import API, { getApiErrorMessage } from "../../lib/api";
import { getUser } from "../../lib/auth";
import { motion } from "framer-motion";
import ProtectedRoute from "../../components/ProtectedRoute";
import AppToast from "../../components/AppToast";
import { fetchCurrentUser } from "../../lib/session";

export default function Deposit() {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
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

  const wallet = "0xEC4Edc0654Ee207F9dB9E1068d3adfE689362B64";

  // 🔐 AUTH
  useEffect(() => {
    const cached = getUser();
    if (cached) setUser(cached);
    fetchCurrentUser().then((fresh) => {
      if (fresh) setUser(fresh);
    });
  }, []);

  // 🚀 SUBMIT
  const handleDeposit = async () => {
    if (loading) return;

    const amt = Number(amount);

    if (!Number.isFinite(amt) || amt <= 0) {
      return showToast("Amount must be greater than 0");
    }

    if (!txHash || txHash.trim().length < 20) {
      return showToast("Invalid TX Hash");
    }

    try {
      setLoading(true);
      const idempotencyKey = getSubmissionIdempotencyKey();

      const res = await API.post(
        "/deposit",
        {
          amount: amt,
          txHash: txHash.trim().toLowerCase(),
        },
        {
          headers: { "Idempotency-Key": idempotencyKey },
        }
      );

      showToast(res?.data?.msg || "Deposit submitted successfully");

      setAmount("");
      setTxHash("");
      resetSubmissionIdempotencyKey();

      router.push("/dashboard");

    } catch (err: any) {
      showToast(getApiErrorMessage(err, "Deposit failed ❌"));
    } finally {
      setLoading(false);
    }
  };

  // 📋 COPY
  const copyWallet = async () => {
    await navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ProtectedRoute>
    <div className="min-h-screen max-w-[420px] mx-auto px-4 py-6 text-white relative overflow-hidden bg-[#040406]">
      <AppToast message={toast} />

      {/* 🌌 BACKGROUND */}
      <div className="absolute w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[150px] top-[-150px] left-[-150px]" />
      <div className="absolute w-[500px] h-[500px] bg-indigo-600 opacity-20 blur-[150px] bottom-[-150px] right-[-150px]" />

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 relative z-10">
        <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
          Deposit 💰
        </h1>

        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-purple-400 hover:opacity-80"
        >
          Back
        </button>
      </div>

      {/* BALANCE */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white/5 p-4 rounded-2xl border border-white/10 mb-6 text-center"
      >
        <p className="text-xs text-gray-400">Your Balance</p>
        <h2 className="text-3xl font-bold text-green-400 mt-1">
          ${Number(user?.balance || 0).toFixed(2)}
        </h2>
      </motion.div>

      {/* CARD */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-[1px] rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500"
      >
        <div className="bg-[#0b0b0f]/90 backdrop-blur-xl p-5 rounded-2xl">

          <p className="text-sm text-gray-400 mb-3">
            Send USDT (BEP20 Network)
          </p>

          {/* WALLET */}
          <div className="bg-black/40 p-3 rounded-xl border border-white/10 flex justify-between items-center">
            <span className="truncate text-xs">{wallet}</span>

            <button
              onClick={copyWallet}
              className="text-xs px-2 py-1 rounded-lg bg-purple-500/20 text-purple-400"
            >
              {copied ? "Copied ✅" : "Copy"}
            </button>
          </div>

          {/* QUICK AMOUNTS */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[10, 50, 100].map((val) => (
              <button
                key={val}
                disabled={loading}
                onClick={() => {
                  resetSubmissionIdempotencyKey();
                  setAmount(String(val));
                }}
                className="bg-white/5 p-2 rounded-lg text-xs hover:bg-purple-500/20 transition"
              >
                ${val}
              </button>
            ))}
          </div>

          {/* AMOUNT */}
          <input
            type="number"
            placeholder="Enter Amount ($)"
            value={amount}
            disabled={loading}
            onChange={(e) => {
              resetSubmissionIdempotencyKey();
              setAmount(e.target.value);
            }}
            className="w-full mt-4 bg-white/5 border border-white/10 focus:border-purple-500 outline-none p-3 rounded-xl text-sm"
          />

          {/* TX HASH */}
          <input
            type="text"
            placeholder="Transaction Hash"
            value={txHash}
            disabled={loading}
            onChange={(e) => {
              resetSubmissionIdempotencyKey();
              setTxHash(e.target.value);
            }}
            className="w-full mt-3 bg-white/5 border border-white/10 focus:border-purple-500 outline-none p-3 rounded-xl text-sm"
          />

          {/* BUTTON */}
          <button
            onClick={handleDeposit}
            disabled={loading}
            className="mt-5 w-full bg-gradient-to-r from-purple-500 to-indigo-500 p-3 rounded-xl font-semibold shadow-lg hover:scale-105 transition flex justify-center items-center gap-2"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {loading ? "Processing..." : "Submit Deposit 🚀"}
          </button>

        </div>
      </motion.div>

      {/* INFO */}
      <div className="mt-5 bg-white/5 p-4 rounded-2xl border border-white/10 text-sm">
        <p className="text-yellow-400 font-semibold mb-2">⚠️ Important</p>

        <ul className="space-y-1 text-gray-400 text-xs">
          <li>• Send only USDT (BEP20)</li>
          <li>• Minimum deposit: $10</li>
          <li>• Confirmation: 1–2 minutes</li>
          <li>• Wrong network = loss</li>
        </ul>
      </div>

    </div>
    </ProtectedRoute>
  );
}