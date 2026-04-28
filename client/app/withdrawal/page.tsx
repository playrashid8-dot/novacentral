"use client";

import { useState, useEffect } from "react";
import { getApiErrorMessage, suppressDuplicateCatchToast } from "../../lib/api";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import ProtectedRoute from "../../components/ProtectedRoute";
import AppToast from "../../components/AppToast";
import { fetchCurrentUser } from "../../lib/session";
import CountdownTimer from "../../components/CountdownTimer";
import GlassCard from "../../components/GlassCard";
import PrimaryButton from "../../components/PrimaryButton";
import { withdrawalStatusClass } from "../../lib/helpers";
import { fetchHybridSummary, fetchHybridWithdrawals, requestHybridWithdraw } from "../../lib/hybrid";

const activePendingStatuses = ["pending", "claimable", "approved"];

export default function Withdrawal() {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [withdrawPassword, setWithdrawPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");
  const [hybrid, setHybrid]: any = useState(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const spendableHybridBalance =
    Number(hybrid?.depositBalance || 0) + Number(hybrid?.rewardBalance || 0);

  const withdrawMin =
    hybrid?.withdrawMinAmount != null && Number.isFinite(Number(hybrid.withdrawMinAmount))
      ? Number(hybrid.withdrawMinAmount)
      : null;
  const lockHours =
    hybrid?.withdrawLockHours != null && Number.isFinite(Number(hybrid.withdrawLockHours))
      ? Number(hybrid.withdrawLockHours)
      : null;

  const loadHybrid = async () => {
    try {
      setLoadError("");
      const [hybridData, withdrawalData] = await Promise.all([
        fetchHybridSummary().catch(() => null),
        fetchHybridWithdrawals().catch(() => []),
      ]);
      setHybrid(hybridData);
      setWithdrawals(withdrawalData || []);
    } catch (e: any) {
      setLoadError(getApiErrorMessage(e, "Could not load withdrawal data"));
    }
  };

  const pendingWithdrawal =
    withdrawals.find((item) => activePendingStatuses.includes(item.status)) || null;
  const latestWithdrawal = withdrawals[0] || null;
  const timerSource =
    pendingWithdrawal?.availableAt != null
      ? pendingWithdrawal
      : latestWithdrawal?.availableAt != null
        ? latestWithdrawal
        : null;
  const cooldownTarget = timerSource?.availableAt
    ? new Date(timerSource.availableAt).getTime()
    : 0;

  useEffect(() => {
    Promise.all([fetchCurrentUser(), loadHybrid()]).then(([fresh]) => {
      if (fresh) {
        setWalletAddress(fresh.walletAddress || "");
      }
    });
  }, []);

  const withdraw = async () => {
    if (loading) return;

    const amt = Number(amount || 0);

    if (withdrawMin == null) {
      return showToast("Loading withdrawal rules…");
    }

    if (!Number.isFinite(amt) || amt < withdrawMin) {
      return showToast(`Minimum withdrawal is $${withdrawMin}`);
    }

    if (amt > spendableHybridBalance) {
      return showToast("Insufficient Hybrid balance");
    }

    if (!walletAddress.trim()) {
      return showToast("Wallet address is required");
    }

    if (!withdrawPassword.trim()) {
      return showToast("Enter password");
    }

    try {
      setLoading(true);
      await requestHybridWithdraw(
        {
          amount: amt,
          walletAddress: walletAddress.trim(),
          password: withdrawPassword,
        },
        globalThis.crypto?.randomUUID?.()
      );

      showToast("Hybrid withdrawal requested");
      setAmount("");
      await loadHybrid();
    } catch (err: any) {
      if (!suppressDuplicateCatchToast(err)) {
        showToast(getApiErrorMessage(err, "Failed ❌"));
      }
    } finally {
      setLoading(false);
    }
  };

  const pendingNet = Number(pendingWithdrawal?.netAmount ?? pendingWithdrawal?.grossAmount ?? 0);

  return (
    <ProtectedRoute>
    <div className="min-h-screen max-w-[420px] mx-auto px-4 py-6 pb-10 text-white relative bg-[#040406] overflow-x-hidden w-full">
      <AppToast message={toast} />

      <div className="absolute w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[150px] top-[-150px] left-[-150px]" />
      <div className="absolute w-[500px] h-[500px] bg-indigo-600 opacity-20 blur-[150px] bottom-[-150px] right-[-150px]" />

      <div className="flex justify-between items-center mb-6 relative z-10">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-purple-300/70">Secure Payout</p>
          <h1 className="text-2xl font-black bg-gradient-to-r from-purple-300 via-fuchsia-300 to-blue-300 bg-clip-text text-transparent">
            HybridEarn Withdraw
          </h1>
        </div>

        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="max-w-full shrink-0 text-sm text-purple-300 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 hover:bg-purple-500/15 transition-all duration-300 shadow-md hover:shadow-lg"
        >
          Back
        </button>
      </div>

      {loadError && (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {loadError}
        </div>
      )}

      <div className="bg-gradient-to-br from-purple-500/20 via-indigo-500/10 to-blue-500/10 p-5 rounded-3xl border border-purple-300/30 text-center mb-4 backdrop-blur-2xl shadow-[0_0_45px_rgba(124,58,237,0.28)]">
        <p className="text-xs text-gray-400 uppercase tracking-[0.22em]">Available Balance</p>
        <h2 className="text-4xl font-black text-white text-glow">
          ${spendableHybridBalance.toFixed(2)}
        </h2>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Pending (net)</p>
          <p className="mt-1 text-sm font-black text-yellow-200">
            {pendingWithdrawal ? `$${pendingNet.toFixed(2)}` : "No Pending"}
          </p>
        </div>
        <CountdownTimer
          targetTime={cooldownTarget ? new Date(cooldownTarget).toISOString() : null}
          label={lockHours != null ? `${lockHours}h Timer` : "Lock timer"}
          completeText={timerSource ? "Window Complete" : "No Cooldown"}
          className="p-4"
        />
      </div>

      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
        <GlassCard glow="purple">
          <div className="mb-4">
            <p className="text-sm font-semibold text-white">Withdraw USDT</p>
            <p className="mt-1 text-xs text-gray-400">
              Confirm with your account password.
            </p>
          </div>

          <input
            type="number"
            placeholder={
              withdrawMin != null
                ? `Enter Amount ($${withdrawMin} minimum)`
                : "Enter Amount (loading minimum…)"
            }
            value={amount}
            disabled={loading}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-white/[0.06] border border-white/10 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/25 focus:shadow-[0_0_28px_rgba(124,58,237,0.3)] outline-none p-3 rounded-xl text-sm transition-all duration-300 placeholder:text-gray-600"
          />

          <input
            type="text"
            placeholder="Wallet Address (BEP20)"
            value={walletAddress}
            disabled={loading}
            onChange={(e) => setWalletAddress(e.target.value)}
            className="w-full mt-3 bg-white/[0.06] border border-white/10 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/25 focus:shadow-[0_0_28px_rgba(124,58,237,0.3)] outline-none p-3 rounded-xl text-sm transition-all duration-300 placeholder:text-gray-600"
          />

          <input
            type="password"
            placeholder="Account password"
            value={withdrawPassword}
            disabled={loading}
            onChange={(e) => setWithdrawPassword(e.target.value)}
            className="w-full mt-3 bg-white/[0.06] border border-white/10 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/25 outline-none p-3 rounded-xl text-sm placeholder:text-gray-600"
          />

          <PrimaryButton
            type="button"
            onClick={withdraw}
            disabled={loading || withdrawMin == null}
            loading={loading}
            className="mt-5 shadow-lg hover:shadow-xl"
          >
            Withdraw
          </PrimaryButton>
        </GlassCard>
      </motion.div>

      {withdrawals.length > 0 && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-2xl">
          <p className="text-sm font-semibold text-white">Recent withdrawals</p>
          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
            {withdrawals.slice(0, 8).map((w) => (
              <div
                key={w._id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs"
              >
                <div>
                  <p className="text-white">
                    Net ${Number(w.netAmount ?? 0).toFixed(2)}{" "}
                    <span className="text-gray-500">· Gross ${Number(w.grossAmount ?? 0).toFixed(2)}</span>
                  </p>
                  <p className={`text-[10px] font-medium ${withdrawalStatusClass(w.status)}`}>{w.status}</p>
                </div>
                <p className="text-[10px] text-gray-500">
                  {w.createdAt ? new Date(w.createdAt).toLocaleDateString() : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 bg-white/[0.06] p-4 rounded-2xl border border-white/10 text-sm backdrop-blur-2xl">
        <p className="text-yellow-300 font-semibold mb-2">Important</p>

        <ul className="space-y-1 text-gray-400 text-xs">
          <li>
            Minimum withdraw:{" "}
            {withdrawMin != null
              ? `$${withdrawMin} (after fee you receive the net amount shown)`
              : "…"}
          </li>
          <li>Processing time: 24-96 hours after lock; admin pays on-chain</li>
          <li>
            Cooldown:{" "}
            {lockHours != null
              ? `${lockHours} hours after each withdraw request`
              : "…"}
          </li>
          <li>Ensure correct BEP20 wallet address</li>
        </ul>
      </div>
    </div>
    </ProtectedRoute>
  );
}
