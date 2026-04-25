"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import API from "../../lib/api";
import { getUser } from "../../lib/auth";
import { motion } from "framer-motion";

export default function Deposit() {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [user, setUser]: any = useState(null);

  const wallet = "0xEC4Edc0654Ee207F9dB9E1068d3adfE689362B64";

  // 🔐 AUTH + USER LOAD
  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace("/login"); // 🔥 better
      return;
    }

    setUser(u);
  }, []);

  // 🚀 SUBMIT
  const handleDeposit = async () => {
    if (loading) return;

    const amt = Number(amount);

    // 🔥 VALIDATION (IMPROVED)
    if (!amt || amt < 10) {
      return alert("Minimum deposit is $10");
    }

    if (!txHash || txHash.trim().length < 20) {
      return alert("Invalid TX Hash");
    }

    try {
      setLoading(true);

      await API.post("/deposit", {
        amount: amt,
        txHash: txHash.trim().toLowerCase(), // 🔥 normalize
      });

      alert("Deposit submitted successfully 🚀");

      // 🔄 RESET
      setAmount("");
      setTxHash("");

      router.push("/dashboard");

    } catch (err: any) {
      alert(err?.response?.data?.msg || "Deposit failed ❌");
    } finally {
      setLoading(false);
    }
  };

  // 📋 COPY
  const copyWallet = async () => {
    try {
      await navigator.clipboard.writeText(wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Copy failed");
    }
  };

  return (
    <div className="min-h-screen text-white px-5 py-6 glow-bg relative">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-glow">💰 Deposit</h1>

        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-purple-400 hover:opacity-80 transition"
        >
          Back
        </button>
      </div>

      {/* 💰 BALANCE */}
      <div className="glow-card mb-6">
        <p className="text-sm opacity-80">Your Balance</p>
        <h2 className="text-3xl font-bold mt-1">
          ${Number(user?.balance || 0).toFixed(2)}
        </h2>
      </div>

      {/* MAIN */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card"
      >
        <p className="text-sm text-gray-400 mb-3">
          Send USDT (BEP20 Network)
        </p>

        {/* WALLET */}
        <div className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/10">
          <span className="truncate text-sm">{wallet}</span>

          <button
            onClick={copyWallet}
            className="text-purple-400 text-xs hover:opacity-80 transition"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        {/* AMOUNT */}
        <input
          type="number"
          placeholder="Enter Amount ($)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input mt-4"
        />

        {/* TX HASH */}
        <input
          type="text"
          placeholder="Enter Transaction Hash"
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          className="input mt-3"
        />

        {/* BUTTON */}
        <button
          onClick={handleDeposit}
          disabled={loading}
          className="btn w-full mt-5 flex justify-center items-center gap-2"
        >
          {loading && (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {loading ? "Processing..." : "Submit Deposit"}
        </button>
      </motion.div>

      {/* ⚠️ INFO */}
      <div className="card mt-5 text-sm">
        <p className="text-yellow-400 font-semibold mb-2">⚠️ Important</p>

        <ul className="space-y-1 text-gray-400">
          <li>• Send only USDT (BEP20)</li>
          <li>• Minimum deposit: $10</li>
          <li>• Confirmation: 1–2 minutes</li>
          <li>• Wrong network = loss</li>
        </ul>
      </div>
    </div>
  );
}