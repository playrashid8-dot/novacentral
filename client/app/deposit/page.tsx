"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import QRCode from "react-qr-code";
import ProtectedRoute from "../../components/ProtectedRoute";
import AppToast from "../../components/AppToast";
import Button from "../../components/Button";
import { fetchCurrentUser } from "../../lib/session";
import { fetchHybridSummary } from "../../lib/hybrid";
import GlassCard from "../../components/GlassCard";
import StatusBadge from "../../components/StatusBadge";
import { depositRowStatusClass, maskAddress } from "../../lib/helpers";

/** Matches server HYBRID_DEPOSIT_CONFIRMATIONS_REQUIRED (UI display only). */
const DEPOSIT_CONFIRMATIONS_REQUIRED = 3;

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
  const minDeposit =
    hybrid?.minDepositAmount != null && Number.isFinite(Number(hybrid.minDepositAmount))
      ? Number(hybrid.minDepositAmount)
      : null;

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
    <div className="relative w-full max-w-full overflow-x-hidden pb-6 text-white">
      <AppToast message={toast} />

      {/* HEADER */}
      <div className="relative z-10 mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-indigo-300/80">
            Wallet top-up
          </p>
          <h1 className="mt-1 bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-2xl font-black text-transparent sm:text-3xl">
            Deposit
          </h1>
        </div>

        <Button variant="ghost" className="w-full sm:w-auto" type="button" onClick={() => router.push("/dashboard")}>
          Back
        </Button>
      </div>

      {/* BALANCE */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-6 rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#6366F1]/25 via-[#111827] to-[#0B0F19] p-6 text-center shadow-[0_12px_48px_rgba(99,102,241,0.2)] ring-1 ring-white/[0.06]"
      >
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-gray-500">Your balance</p>
        <h2 className="mt-2 text-4xl font-black tracking-tight text-white tabular-nums">
          ${(Number(hybrid?.depositBalance || 0) + Number(hybrid?.rewardBalance || 0)).toFixed(2)}
        </h2>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <GlassCard glow="purple">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">Send USDT (BEP20)</p>
            <span className="rounded-full border border-[#6366F1]/30 bg-[#6366F1]/15 px-3 py-1 text-[10px] font-bold text-indigo-200">
              BEP20
            </span>
          </div>

          <p className="mb-4 text-xs text-gray-400">
            Send USDT (BEP20) to your dedicated address. Copy the full address — display below is masked.
          </p>

          {wallet ? (
            <div className="mx-auto mb-5 flex max-w-[220px] justify-center rounded-2xl border border-white/[0.08] bg-white p-3 shadow-inner ring-1 ring-black/20">
              <QRCode value={wallet} size={168} level="M" fgColor="#111827" bgColor="#ffffff" />
            </div>
          ) : (
            <div className="mx-auto mb-5 flex h-[196px] max-w-[220px] items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/40 text-xs text-gray-500">
              {walletLoading ? "Generating QR…" : "No wallet yet"}
            </div>
          )}

          <div className="rounded-2xl border border-white/[0.08] bg-black/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Masked address</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex items-center gap-2">
                {!wallet && walletLoading && (
                  <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-[#6366F1]/30 border-t-[#6366F1]" />
                )}
                <span className="truncate font-mono text-xs text-gray-200">
                  {wallet ? maskAddress(wallet) : walletLoading ? "Generating wallet…" : "—"}
                </span>
              </div>
              <button
                type="button"
                onClick={copyWallet}
                disabled={!wallet}
                className="w-full shrink-0 rounded-2xl bg-[#6366F1]/20 px-4 py-2.5 text-xs font-semibold text-indigo-100 ring-1 ring-[#6366F1]/35 transition hover:scale-[1.02] hover:bg-[#6366F1]/30 disabled:opacity-40 sm:w-auto"
              >
                {copied ? "Copied" : "Copy full address"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold text-amber-200">
              Auto listener
            </span>
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold text-emerald-200">
              No manual approval
            </span>
          </div>

          <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-xs leading-relaxed text-cyan-50/95">
            Deposit credits are handled automatically after BEP20 confirmation. No transaction hash is required.
          </div>
        </GlassCard>
      </motion.div>

      {/* INFO */}
      <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#111827]/80 p-4 text-sm ring-1 ring-white/[0.04] backdrop-blur-xl">
        <p className="mb-2 font-semibold text-amber-400">Important</p>

        <ul className="space-y-1 text-xs text-gray-400">
          <li>Send only USDT (BEP20)</li>
          <li>Minimum deposit: {minDeposit != null ? `$${minDeposit} USDT` : "…"}</li>
          <li>Confirmation: 1–2 minutes</li>
          <li>Wrong network = permanent loss</li>
        </ul>
      </div>

      {!!hybrid?.deposits?.length && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111827]/80 backdrop-blur-xl ring-1 ring-white/[0.04]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Chain</th>
                  <th className="px-4 py-3 text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {hybrid.deposits.slice(0, 5).map((deposit: any) => {
                  const conf = Number(deposit?.confirmations ?? 0);
                  const failed =
                    deposit?.confirmationStatus === "failed" ||
                    String(deposit?.status || "").toLowerCase().includes("fail");
                  const done = !failed && conf >= DEPOSIT_CONFIRMATIONS_REQUIRED;
                  const pending = !failed && !done;

                  return (
                    <tr key={deposit._id} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-4 py-3 font-semibold text-white tabular-nums">
                        ${Number(deposit.amount ?? 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <StatusBadge tier={failed ? "danger" : done ? "success" : "warning"}>
                            {failed ? "Failed" : done ? "Confirmed" : "Pending"}
                          </StatusBadge>
                          <span className={`text-[10px] ${depositRowStatusClass(deposit)}`}>
                            {deposit.status ?? "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">
                        {deposit.createdAt ? new Date(deposit.createdAt).toLocaleDateString() : "—"}
                        {pending ? (
                          <span className="mt-1 block text-[10px] text-amber-200/90">
                            {conf}/{DEPOSIT_CONFIRMATIONS_REQUIRED} conf.
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
    </ProtectedRoute>
  );
}