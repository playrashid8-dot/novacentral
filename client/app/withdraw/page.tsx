"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import ProtectedRoute from "../../components/ProtectedRoute";
import { getApiErrorMessage } from "../../lib/api";
import { showToast as showVipToast } from "../../lib/vipToast";
import { estimateWithdrawNetUsd, inferWithdrawFeeRate } from "../../lib/withdrawFeeEstimate";
import { fetchHybridSummary, fetchHybridWithdrawals, requestHybridWithdraw } from "../../lib/hybrid";
import { maskAddress, isValidEvmAddress42 } from "../../lib/helpers";
import { getWithdrawalBadgeVariant, getWithdrawalStatusLabel } from "../../lib/withdrawUi";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { SkeletonLine } from "../../components/Skeleton";

const BSC_TX_PREFIX = "https://bscscan.com/tx/";

function formatWithdrawSubmitError(err: unknown, fallback: string): string {
  const e = err as {
    code?: string;
    response?: { status?: number; data?: { msg?: string; message?: string } };
  };
  if (!e?.response) {
    if (e?.code === "ECONNABORTED" || e?.code === "TIMEOUT") return "Request timed out. Try again.";
    return "Network error, try again";
  }
  const status = e.response.status;
  const msg = String(e.response.data?.msg || e.response.data?.message || "").trim();

  if (status === 401 || /token missing|invalid token|authorization failed/i.test(msg)) {
    return "Please sign in — no valid session token";
  }
  if (/invalid password/i.test(msg)) return "Invalid password";
  if (/pending withdrawal must be completed first/i.test(msg)) {
    return "Withdrawal already pending";
  }
  if (/insufficient hybrid balance or pending withdrawal exists/i.test(msg)) {
    return "Insufficient balance or a withdrawal may already be in progress";
  }
  const minMatch = msg.match(/minimum withdrawal is\s+(\d+(?:\.\d+)?)/i);
  if (minMatch) return `Minimum amount is $${minMatch[1]}`;
  if (/insufficient hybrid balance/i.test(msg)) return "Insufficient balance";

  return msg || fallback;
}

const glassCard =
  "rounded-2xl border border-white/[0.08] bg-white/5 shadow-soft backdrop-blur-xl";

export default function WithdrawPage() {
  const [amount, setAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [withdrawPassword, setWithdrawPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [hybrid, setHybrid] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [detail, setDetail] = useState<any | null>(null);
  const [successBanner, setSuccessBanner] = useState<{ net: number; gross: number } | null>(null);

  const spendableHybridBalance =
    Number(hybrid?.depositBalance || 0) + Number(hybrid?.rewardBalance || 0);

  const withdrawMin =
    hybrid?.withdrawMinAmount != null && Number.isFinite(Number(hybrid.withdrawMinAmount))
      ? Number(hybrid.withdrawMinAmount)
      : null;

  const loadHybrid = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setDataLoading(true);
        setLoadError("");
      }
      const [hybridData, withdrawalData] = await Promise.all([
        fetchHybridSummary().catch(() => null),
        fetchHybridWithdrawals().catch(() => []),
      ]);
      if (silent) {
        if (hybridData) setHybrid(hybridData);
        if (Array.isArray(withdrawalData)) setWithdrawals(withdrawalData);
      } else {
        if (hybridData) setHybrid(hybridData);
        setWithdrawals(withdrawalData || []);
      }
    } catch (e: any) {
      if (!silent) setLoadError(getApiErrorMessage(e, "Could not load withdrawal data"));
    } finally {
      if (!silent) setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHybrid(false);
  }, [loadHybrid]);

  useEffect(() => {
    const id = window.setInterval(() => void loadHybrid(true), 16000);
    return () => clearInterval(id);
  }, [loadHybrid]);

  const feeRateDisplay = useMemo(() => inferWithdrawFeeRate(withdrawals) * 100, [withdrawals]);

  const feeAppliedLabel = useMemo(() => {
    const r = feeRateDisplay;
    const pct = Math.abs(r - Math.round(r)) < 0.05 ? Math.round(r).toString() : r.toFixed(1);
    return `≈ ${pct}% fee applied`;
  }, [feeRateDisplay]);

  const netPreview = useMemo(
    () => estimateWithdrawNetUsd(Number(amount || 0), withdrawals),
    [amount, withdrawals],
  );

  const withdraw = async () => {
    if (loading) return;
    setSubmitError("");

    const amt = Number(amount || 0);

    if (withdrawMin == null) {
      return;
    }

    if (!Number.isFinite(amt) || amt < withdrawMin) {
      return showVipToast("error", `Minimum amount is $${withdrawMin}`);
    }

    if (amt > spendableHybridBalance) {
      return showVipToast("error", "Insufficient balance");
    }

    if (!isValidEvmAddress42(walletAddress.trim())) {
      return showVipToast("error", "Enter a valid wallet: 0x + 40 hex characters (42 total)");
    }

    if (!withdrawPassword.trim()) {
      return showVipToast("error", "Enter password");
    }

    try {
      setLoading(true);
      const payload = {
        amount: amt,
        walletAddress: walletAddress.trim(),
        password: withdrawPassword,
      };

      const result: any = await requestHybridWithdraw(
        payload,
        globalThis.crypto?.randomUUID?.(),
      );

      const nw = Number(result?.withdrawal?.netAmount ?? netPreview);
      const gr = Number(result?.withdrawal?.grossAmount ?? amt);
      setSuccessBanner({
        net: Number.isFinite(nw) ? nw : netPreview,
        gross: Number.isFinite(gr) ? gr : amt,
      });
      window.setTimeout(() => setSuccessBanner(null), 12000);

      showVipToast("success", "Withdrawal request submitted");
      setAmount("");
      setWithdrawPassword("");
      await loadHybrid(true);
    } catch (err: any) {
      const msg = formatWithdrawSubmitError(err, getApiErrorMessage(err, "Request failed"));
      setSubmitError(msg);
      const toastMsg =
        /already pending/i.test(msg) ? "Withdrawal already pending" : msg;
      showVipToast("error", toastMsg);
    } finally {
      setLoading(false);
    }
  };

  const modalBody = useMemo(() => {
    if (!detail) return null;
    const gross = Number(detail.grossAmount ?? 0);
    const fee = Number(detail.feeAmount ?? Math.max(0, gross - Number(detail.netAmount ?? 0)));
    const net = Number(detail.netAmount ?? 0);
    const label = getWithdrawalStatusLabel(detail.status);
    const variant = getWithdrawalBadgeVariant(detail.status);
    const hash = detail.txHash ? String(detail.txHash) : "";

    return (
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-gray-400">Status</span>
          <Badge variant={variant}>{label}</Badge>
        </div>

        <WithdrawalTimeline status={detail.status} />

        <Row label="Amount (gross)" value={`${gross.toFixed(2)} USDT`} />
        <Row label="Fee" value={`${fee.toFixed(2)} USDT`} />
        <Row label="You receive (net)" value={`${net.toFixed(2)} USDT`} highlight />
        <Row
          label="Address"
          value={detail.walletAddress ? String(detail.walletAddress) : "—"}
          mono
        />
        <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Transaction
          </p>
          {hash ? (
            <HashActions txHash={hash} />
          ) : (
            <p className="mt-2 text-xs text-gray-500">TX hash appears after payout is recorded.</p>
          )}
        </div>
      </div>
    );
  }, [detail]);

  return (
    <ProtectedRoute>
      <div className={`relative w-full max-w-lg space-y-4 px-4 pb-24 text-white`}>
        {loadError ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {loadError}
          </div>
        ) : null}

        {submitError ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/35 bg-red-500/[0.14] px-4 py-3 text-sm font-medium text-red-50 shadow-[0_8px_32px_rgba(220,38,38,0.12)] ring-1 ring-red-400/25"
          >
            {submitError}
          </div>
        ) : null}

        {successBanner ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.12] px-4 py-3 text-sm text-emerald-50 ring-1 ring-emerald-400/25"
          >
            <p className="font-semibold text-emerald-100">
              Queued — est.{" "}
              <span className="tabular-nums">${successBanner.net.toFixed(2)}</span> net (from{" "}
              <span className="tabular-nums">${successBanner.gross.toFixed(2)}</span> gross).
            </p>
          </motion.div>
        ) : null}

        <Card className={`!bg-white/5 !shadow-soft backdrop-blur-xl ${glassCard} !border-white/[0.08]`}>
          <div className="space-y-4">
            <Input
              label="Amount (USDT)"
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              disabled={loading}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
            />
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
                Est. receive
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-emerald-100">
                {Number(amount || 0) > 0 ? `${netPreview.toFixed(2)} USDT` : "—"}
              </p>
              <p className="mt-1 text-[11px] text-emerald-200/80">{feeAppliedLabel}</p>
            </div>
            <Input
              label="Wallet Address"
              autoComplete="off"
              placeholder="0x…"
              value={walletAddress}
              disabled={loading}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setWalletAddress(e.target.value)}
              hint="Enter BEP20 address"
            />
            <Input
              label="Account Password"
              type="password"
              placeholder="••••••••"
              value={withdrawPassword}
              disabled={loading}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setWithdrawPassword(e.target.value)}
            />
          </div>

          <Button
            type="button"
            className="mt-6 !rounded-xl !bg-gradient-to-r !from-emerald-600 !to-emerald-600 !py-3 !shadow-none hover:!from-emerald-500 hover:!to-emerald-500 hover:!brightness-100"
            size="lg"
            loading={loading}
            disabled={loading || withdrawMin == null}
            onClick={() => void withdraw()}
          >
            Submit Withdrawal
          </Button>
        </Card>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white">Withdrawal History</h3>

          {dataLoading ? (
            <div className="space-y-3">
              <SkeletonLine className="h-28 w-full rounded-2xl" />
              <SkeletonLine className="h-28 w-full rounded-2xl" />
            </div>
          ) : withdrawals.length === 0 ? (
            <div className={`${glassCard} px-4 py-10 text-center text-sm text-gray-500`}>
              No withdrawals yet
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((w) => {
                const variant = getWithdrawalBadgeVariant(w.status);
                const net = Number(w.netAmount ?? 0);
                const addr = w.walletAddress ? maskAddress(String(w.walletAddress)) : "—";
                const dateStr = w.createdAt ? new Date(w.createdAt).toLocaleString() : "";
                return (
                  <motion.div key={w._id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className={`!p-4 transition hover:border-white/[0.12] ${glassCard} !bg-white/[0.04]`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0 space-y-2 text-sm">
                          <p className="text-white">
                            <span className="text-gray-500">Amount: </span>
                            <span className="font-bold tabular-nums">${net.toFixed(2)}</span>
                          </p>
                          <p className="truncate text-white">
                            <span className="text-gray-500">Wallet: </span>
                            <span className="font-mono text-xs text-gray-300">{addr}</span>
                          </p>
                          <p className="flex flex-wrap items-center gap-2">
                            <span className="text-gray-500">Status: </span>
                            <Badge variant={variant}>{getWithdrawalStatusLabel(w.status)}</Badge>
                          </p>
                          <p className="text-xs text-gray-500">{dateStr}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDetail(w)}
                          className="min-h-[44px] shrink-0 rounded-xl border border-blue-500/35 bg-blue-500/10 px-4 py-3 text-xs font-semibold text-blue-100 transition hover:bg-blue-500/20 active:scale-[0.98] sm:min-w-[88px]"
                        >
                          View
                        </button>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <Modal
          open={!!detail}
          title="Withdrawal details"
          onClose={() => setDetail(null)}
          footer={
            <Button variant="ghost" size="md" className="!w-full sm:!w-auto" onClick={() => setDetail(null)}>
              Close
            </Button>
          }
        >
          {modalBody}
        </Modal>
      </div>
    </ProtectedRoute>
  );
}

function WithdrawalTimeline({ status }: { status?: string }) {
  const s = String(status || "").toLowerCase();
  const rejected = s === "rejected";
  const terminalOk = s === "paid" || s === "claimed";
  const processing = ["pending", "claimable", "approved"].includes(s);

  const pill = (kind: "done" | "active" | "idle" | "bad") => {
    if (kind === "done") {
      return "border-emerald-500/55 bg-emerald-500/[0.12] shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)] text-emerald-100";
    }
    if (kind === "active") {
      return "border-amber-400/45 bg-amber-500/10 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.25)] text-amber-100";
    }
    if (kind === "bad") {
      return "border-red-400/40 bg-red-500/[0.08] text-red-200";
    }
    return "border-white/[0.08] bg-black/22 text-gray-500";
  };

  const midKind = rejected ? ("bad" as const) : terminalOk ? ("done" as const) : processing ? "active" : "idle";

  const endKind = rejected ? ("bad" as const) : terminalOk ? ("done" as const) : "idle";

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/25 px-4 py-3 ring-1 ring-white/[0.04]">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Progress</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div
          className={`rounded-xl border px-2 py-2.5 text-[11px] font-semibold transition ${pill("done")}`}
        >
          <p className="text-[9px] font-bold uppercase tracking-wide text-current/85">1</p>
          <p>Requested</p>
        </div>
        <div className={`rounded-xl border px-2 py-2.5 text-[11px] font-semibold transition ${pill(midKind)}`}>
          <p className="text-[9px] font-bold uppercase tracking-wide text-current/85">2</p>
          <p>{rejected ? "Rejected" : "Processing"}</p>
          {processing && !rejected ? (
            <span className="mt-2 inline-block h-1 w-full animate-pulse rounded-full bg-amber-400/50" />
          ) : null}
        </div>
        <div className={`rounded-xl border px-2 py-2.5 text-[11px] font-semibold transition ${pill(endKind)}`}>
          <p className="text-[9px] font-bold uppercase tracking-wide text-current/85">3</p>
          <p>{terminalOk ? "Paid" : rejected ? "Not paid" : "Settlement"}</p>
        </div>
      </div>
      {rejected ? (
        <p className="mt-2 text-center text-[11px] text-red-300/95">
          Platform did not disburse this payout.
        </p>
      ) : null}
    </div>
  );
}

function HashActions({ txHash }: { txHash: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(txHash);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const normalized = txHash.trim();
  const bscUrl = /^0x[a-fA-F0-9]{64}$/.test(normalized)
    ? `${BSC_TX_PREFIX}${normalized}`
    : `${BSC_TX_PREFIX}${encodeURIComponent(normalized)}`;

  return (
    <div className="mt-3 space-y-3">
      <p className="break-all font-mono text-xs leading-relaxed text-gray-100">{txHash}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex min-h-[42px] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.07] px-3 py-2.5 text-xs font-bold text-gray-100 transition hover:border-emerald-500/40 hover:bg-emerald-500/10 active:scale-[0.98]"
        >
          {copied ? "Copied" : "Copy TX hash"}
        </button>
        <a
          href={bscUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[42px] flex-1 items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3 py-2.5 text-xs font-bold text-emerald-100 transition hover:bg-emerald-500/25"
        >
          Open in BscScan
        </a>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p
        className={`mt-0.5 text-sm ${highlight ? "font-bold text-emerald-200" : "text-white"} ${mono ? "break-all font-mono text-xs" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
