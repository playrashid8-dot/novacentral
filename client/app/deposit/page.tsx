"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import QRCode from "react-qr-code";
import ProtectedRoute from "../../components/ProtectedRoute";
import Button from "../../components/Button";
import AppToast from "../../components/AppToast";
import VipBadge from "../../components/ui/VipBadge";
import Card from "../../components/ui/Card";
import { fetchCurrentUser } from "../../lib/session";
import { fetchHybridSummary } from "../../lib/hybrid";
import SkeletonCard from "../../components/SkeletonCard";
import StatusBadge from "../../components/StatusBadge";
import { depositRowStatusClass, maskAddress } from "../../lib/helpers";
import { STATUS } from "../../lib/constants";

/** Matches server HYBRID_DEPOSIT_CONFIRMATIONS_REQUIRED (UI display only). */
const DEPOSIT_CONFIRMATIONS_REQUIRED = 3;

function isDepositDone(d: any): boolean {
  const conf = Number(d?.confirmations ?? 0);
  const failed =
    d?.confirmationStatus === STATUS.FAILED ||
    String(d?.status || "").toLowerCase() === STATUS.FAILED ||
    String(d?.status || "").toLowerCase().includes("fail");
  return !failed && conf >= DEPOSIT_CONFIRMATIONS_REQUIRED;
}

export default function Deposit() {
  const router = useRouter();

  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState("");
  const [showFullAddress, setShowFullAddress] = useState(false);
  const [user, setUser]: any = useState(null);
  const [hybrid, setHybrid]: any = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const prevDoneMap = useRef<Map<string, boolean>>(new Map());
  const [flashId, setFlashId] = useState<string | null>(null);

  const wallet = hybrid?.walletAddress || user?.walletAddress || "";
  const vipLevel = Number(hybrid?.level ?? 0);
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

  useEffect(() => {
    const list = hybrid?.deposits || [];
    for (const deposit of list) {
      const id = String(deposit?._id ?? "");
      if (!id) continue;
      const done = isDepositDone(deposit);
      const prev = prevDoneMap.current.get(id);
      if (done && prev === false) {
        setFlashId(id);
        window.setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1600);
      }
      prevDoneMap.current.set(id, done);
    }
  }, [hybrid?.deposits]);


  // 📋 COPY
  const copyWallet = async () => {
    if (!wallet) return;
    await navigator.clipboard.writeText(wallet);
    setCopied(true);
    setToast("Address copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
    setTimeout(() => setToast(""), 2500);
  };

  return (
    <ProtectedRoute>
    <div className="relative w-full max-w-full overflow-x-hidden pb-6 text-white">
      <AppToast message={toast} />

      {/* HEADER */}
      <div className="relative z-10 mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-400/85">
            Wallet top-up
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="bg-gradient-to-r from-white via-emerald-100 to-blue-300 bg-clip-text text-2xl font-black text-transparent sm:text-3xl">
              Deposit
            </h1>
            <VipBadge level={vipLevel} showGlow={vipLevel >= 1} />
          </div>
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
        className="mb-6 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/20 via-[#0f1629] to-blue-600/15 p-6 text-center shadow-glow-emerald ring-1 ring-white/[0.06]"
      >
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-200/80">Your balance</p>
        <h2 className="mt-2 text-4xl font-black tracking-tight text-white tabular-nums">
          ${(Number(hybrid?.depositBalance || 0) + Number(hybrid?.rewardBalance || 0)).toFixed(2)}
        </h2>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">Send USDT (BEP20)</p>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/12 px-3 py-1 text-[10px] font-bold text-emerald-100">
              BEP20
            </span>
          </div>

          <p className="mb-4 text-xs text-gray-400">
            Scan or copy your dedicated deposit address. Toggle to reveal the full address on screen before copying.
          </p>

          {wallet ? (
            <div className="mx-auto mb-5 flex max-w-[220px] justify-center rounded-2xl border border-white/[0.08] bg-white p-3 shadow-inner ring-1 ring-black/20">
              <QRCode value={wallet} size={168} level="M" fgColor="#0B0F19" bgColor="#ffffff" />
            </div>
          ) : (
            <div className="mx-auto mb-5">
              {walletLoading ? (
                <SkeletonCard className="mx-auto mb-0 h-[196px] max-w-[220px] rounded-2xl bg-white/10" />
              ) : (
                <div className="mx-auto flex h-[196px] max-w-[220px] items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/40 text-xs text-gray-500">
                  No wallet yet
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                {showFullAddress ? "Full address" : "Preview"}
              </p>
              <button
                type="button"
                onClick={() => setShowFullAddress((v) => !v)}
                className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-semibold text-gray-300 transition hover:border-emerald-500/30"
              >
                {showFullAddress ? "Hide" : "Show full"}
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex items-start gap-2">
                {!wallet && walletLoading && (
                  <span className="mt-0.5 h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
                )}
                <span className="break-all font-mono text-xs leading-relaxed text-gray-200">
                  {wallet
                    ? showFullAddress
                      ? wallet
                      : maskAddress(wallet)
                    : walletLoading
                      ? "Generating wallet…"
                      : "—"}
                </span>
              </div>
              <button
                type="button"
                onClick={copyWallet}
                disabled={!wallet}
                className="w-full shrink-0 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-400 px-4 py-3 text-xs font-bold text-gray-950 shadow-soft transition hover:brightness-110 disabled:opacity-40 sm:w-auto"
              >
                {copied ? "Copied ✓" : "Copy address"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold text-amber-200">
              Auto listener
            </span>
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold text-emerald-200">
              Confirmed = credited
            </span>
          </div>

          <div className="mt-5 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-xs leading-relaxed text-blue-50/95">
            Deposits move from Pending → Confirmed as BEP20 confirmations arrive. No transaction hash submission required.
          </div>
        </Card>
      </motion.div>

      {/* INFO */}
      <Card className="mt-5 border-amber-500/15">
        <p className="mb-2 font-semibold text-amber-200">Important</p>

        <ul className="space-y-1 text-xs text-gray-400">
          <li>Send only USDT (BEP20)</li>
          <li>Minimum deposit: {minDeposit != null ? `$${minDeposit} USDT` : "…"}</li>
          <li>Confirmation: 1–2 minutes</li>
          <li>Wrong network = permanent loss</li>
        </ul>
      </Card>

      <div className="mt-5">
        <p className="mb-3 text-sm font-bold text-white">Deposit history</p>
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-card shadow-soft backdrop-blur-xl">
          <div className="overflow-x-auto">
            {walletLoading && !hybrid ? (
              <div className="space-y-0 px-2 py-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex gap-3 border-b border-white/[0.04] py-3 last:border-0"
                  >
                    <div className="h-4 w-16 animate-pulse rounded bg-white/10" />
                    <div className="h-4 flex-1 animate-pulse rounded bg-white/10" />
                    <div className="h-4 w-20 animate-pulse rounded bg-white/10" />
                  </div>
                ))}
              </div>
            ) : !!hybrid?.deposits?.length ? (
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">When</th>
                  </tr>
                </thead>
                <tbody>
                  {hybrid.deposits.slice(0, 8).map((deposit: any) => {
                    const conf = Number(deposit?.confirmations ?? 0);
                    const failed =
                      deposit?.confirmationStatus === STATUS.FAILED ||
                      String(deposit?.status || "").toLowerCase() === STATUS.FAILED ||
                      String(deposit?.status || "").toLowerCase().includes("fail");
                    const done = isDepositDone(deposit);
                    const pending = !failed && !done;
                    const rowClass =
                      String(deposit._id) === flashId ? "deposit-row-highlight " : "";

                    return (
                      <tr
                        key={deposit._id}
                        className={`border-b border-white/[0.04] last:border-0 transition hover:bg-white/[0.02] ${rowClass}`}
                      >
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
            ) : (
              <p className="px-4 py-12 text-center text-sm text-gray-500">No deposits yet.</p>
            )}
          </div>
        </div>
      </div>

    </div>
    </ProtectedRoute>
  );
}