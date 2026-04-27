"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import ProtectedRoute from "../../components/ProtectedRoute";
import AppToast from "../../components/AppToast";
import { fetchCurrentUser } from "../../lib/session";
import { fetchHybridSummary } from "../../lib/hybrid";
import GlassCard from "../../components/GlassCard";

export default function Deposit() {
  const router = useRouter();

  const [copied, setCopied] = useState(false);
  const [user, setUser]: any = useState(null);
  const [toast, setToast] = useState("");
  const [hybrid, setHybrid]: any = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const wallet = hybrid?.walletAddress || user?.walletAddress || "";

  // 🔐 AUTH + WALLET LOAD
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    const loadWallet = async (attempt = 0) => {
      const [fresh, hybridData] = await Promise.all([
        fetchCurrentUser().catch(() => null),
        fetchHybridSummary().catch(() => null),
      ]);

      if (cancelled) return;

      if (fresh) setUser(fresh);
      if (hybridData) setHybrid(hybridData);

      const loadedWallet = hybridData?.walletAddress || fresh?.walletAddress || "";

      if (!loadedWallet && attempt < 4) {
        retryTimer = setTimeout(() => loadWallet(attempt + 1), 2000);
        return;
      }

      setWalletLoading(false);
    };

    loadWallet();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, []);

  // 📋 COPY
  const copyWallet = async () => {
    if (!wallet) return;
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
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-purple-300/70">Wallet Top Up</p>
          <h1 className="text-2xl font-black bg-gradient-to-r from-purple-300 via-fuchsia-300 to-blue-300 bg-clip-text text-transparent">
            HybridEarn Deposit
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-gradient-to-br from-purple-500/20 via-indigo-500/10 to-blue-500/10 p-5 rounded-3xl border border-purple-300/30 mb-6 text-center backdrop-blur-2xl shadow-[0_0_45px_rgba(124,58,237,0.28)]"
      >
        <p className="text-xs text-gray-400 uppercase tracking-[0.22em]">Your Balance</p>
        <h2 className="text-4xl font-black text-white mt-1 text-glow">
          ${(Number(hybrid?.depositBalance || 0) + Number(hybrid?.rewardBalance || 0)).toFixed(2)}
        </h2>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
        <GlassCard glow="purple">

          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">
              Send USDT (BEP20)
            </p>
            <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1 text-[10px] font-bold text-blue-200">
              BEP20
            </span>
          </div>

          <p className="text-xs text-gray-400 mb-3">
            Send USDT (BEP20) to this address
          </p>

          <div className="bg-black/40 p-3 rounded-2xl border border-white/10 flex justify-between items-center gap-3">
            <div className="min-w-0 flex items-center gap-2">
              {!wallet && walletLoading && (
                <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-purple-300/30 border-t-purple-300" />
              )}
              <span className="truncate text-xs text-gray-200">
                {wallet || "Generating wallet..."}
              </span>
            </div>

            <button
              onClick={copyWallet}
              disabled={!wallet}
              className="text-xs px-3 py-2 rounded-xl bg-purple-500/20 text-purple-200 border border-purple-300/20 hover:bg-purple-500/30 transition"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-yellow-400/10 border border-yellow-300/20 px-3 py-1 text-[10px] font-semibold text-yellow-200">
              Auto Listener
            </span>
            <span className="rounded-full bg-green-400/10 border border-green-300/20 px-3 py-1 text-[10px] font-semibold text-green-200">
              No Manual Approval
            </span>
          </div>

          <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-xs leading-5 text-cyan-100">
            Deposit credits are handled automatically after BEP20 confirmation. No transaction hash is required.
          </div>
        </GlassCard>
      </motion.div>

      {/* INFO */}
      <div className="mt-5 bg-white/[0.06] p-4 rounded-2xl border border-white/10 text-sm backdrop-blur-2xl">
        <p className="text-yellow-300 font-semibold mb-2">Important</p>

        <ul className="space-y-1 text-gray-400 text-xs">
          <li>Send only USDT (BEP20)</li>
          <li>Minimum deposit: $10</li>
          <li>Confirmation: 1-2 minutes</li>
          <li>Wrong network = loss</li>
        </ul>
      </div>

      {!!hybrid?.deposits?.length && (
        <div className="mt-5 bg-white/[0.06] p-4 rounded-2xl border border-white/10 backdrop-blur-2xl">
          <p className="text-sm font-semibold text-white">Recent Hybrid Deposits</p>
          <div className="mt-3 space-y-2">
            {hybrid.deposits.slice(0, 3).map((deposit: any) => (
              <div
                key={deposit._id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-3"
              >
                <div>
                  <p className="text-xs text-white">${Number(deposit.amount || 0).toFixed(2)}</p>
                  <p className="text-[10px] text-gray-500">{deposit.status}</p>
                </div>
                <p className="text-[10px] text-gray-500">
                  {deposit.createdAt ? new Date(deposit.createdAt).toLocaleDateString() : "Auto"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
    </ProtectedRoute>
  );
}