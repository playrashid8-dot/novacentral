"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import API from "../../lib/api";
import { motion } from "framer-motion";

export default function Deposit() {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const wallet = "0xEC4Edc0654Ee207F9dB9E1068d3adfE689362B64";

  const handleDeposit = async () => {
    try {
      if (!amount || Number(amount) < 10) {
        alert("Minimum deposit is $10");
        return;
      }

      if (!txHash) {
        alert("Enter transaction hash");
        return;
      }

      setLoading(true);

      await API.post("/deposit", {
        amount: Number(amount),
        txHash,
      });

      alert("Deposit submitted 🚀");
      router.push("/dashboard");

    } catch (err) {
      alert("Deposit failed ❌");
    } finally {
      setLoading(false);
    }
  };

  const copyWallet = () => {
    navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white px-5 py-6 relative overflow-hidden">

      {/* 🔥 BACKGROUND GLOW */}
      <div className="absolute w-[400px] h-[400px] bg-purple-600 opacity-20 blur-[120px] top-[-100px] left-[-100px]" />
      <div className="absolute w-[400px] h-[400px] bg-indigo-600 opacity-20 blur-[120px] bottom-[-100px] right-[-100px]" />

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 relative z-10">
        <h1 className="text-xl font-bold">💰 Deposit</h1>

        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-purple-400 hover:underline"
        >
          Back
        </button>
      </div>

      {/* MAIN CARD */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 p-[1px] rounded-3xl bg-gradient-to-r from-purple-500 to-indigo-500"
      >
        <div className="bg-[#0b0b0f]/90 backdrop-blur-xl p-6 rounded-3xl">

          {/* NETWORK */}
          <p className="text-gray-400 text-sm mb-3">
            Send USDT (BEP20 Network)
          </p>

          {/* WALLET BOX */}
          <div className="bg-black/40 p-3 rounded-xl flex justify-between items-center border border-white/10">

            <span className="truncate text-sm">{wallet}</span>

            <button
              onClick={copyWallet}
              className="text-purple-400 text-xs font-semibold"
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
            className="w-full mt-4 p-3 bg-black/40 rounded-xl border border-white/10 outline-none focus:border-purple-500"
          />

          {/* TX HASH */}
          <input
            type="text"
            placeholder="Enter Transaction Hash"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            className="w-full mt-3 p-3 bg-black/40 rounded-xl border border-white/10 outline-none focus:border-purple-500"
          />

          {/* BUTTON */}
          <button
            onClick={handleDeposit}
            disabled={loading}
            className="w-full mt-5 bg-gradient-to-r from-purple-500 to-indigo-500 p-3 rounded-xl font-semibold shadow-lg hover:scale-105 active:scale-95 transition disabled:opacity-50"
          >
            {loading ? "Processing..." : "Submit Deposit"}
          </button>

        </div>
      </motion.div>

      {/* 🔥 VIP INFO CARD */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-5 p-4 rounded-2xl bg-gradient-to-br from-yellow-500/10 to-purple-500/10 border border-yellow-500/20 text-sm relative z-10"
      >
        <p className="font-semibold text-yellow-400 mb-2">⚠️ Important</p>

        <ul className="space-y-1 text-gray-300">
          <li>• Send only USDT (BEP20)</li>
          <li>• Minimum deposit: $10</li>
          <li>• Confirmation within 1–2 minutes</li>
          <li>• Wrong network = funds lost</li>
        </ul>
      </motion.div>

    </div>
  );
}