"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import ProtectedRoute from "../../components/ProtectedRoute";
import AppToast from "../../components/AppToast";
import EmptyState from "../../components/EmptyState";
import CountdownTimer from "../../components/CountdownTimer";
import WithdrawPageSkeleton from "../../components/WithdrawPageSkeleton";
import LiveRefreshIndicator from "../../components/LiveRefreshIndicator";
import { getApiErrorMessage, suppressDuplicateCatchToast } from "../../lib/api";
import { estimateWithdrawNetUsd, inferWithdrawFeeRate } from "../../lib/withdrawFeeEstimate";
import { fetchHybridSummary, fetchHybridWithdrawals, requestHybridWithdraw } from "../../lib/hybrid";
import { maskAddress, isValidEvmAddress42 } from "../../lib/helpers";
import { getWithdrawalBadgeVariant, getWithdrawalStatusLabel } from "../../lib/withdrawUi";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import VipBadge from "../../components/ui/VipBadge";

const activePendingStatuses = ["pending", "claimable", "approved"];
const BSC_TX_PREFIX = "https://bscscan.com/tx/";

function formatWithdrawSubmitError(err: unknown, fallback: string): string {
  const e = err as {
    code?: string;
    response?: { status?: number; data?: { msg?: string; message?: string } };
  };
  if (!e?.response) {
    if (e?.code === "ECONNABORTED") return "Request timed out — try again";
    return "Network error, try again";
  }
  const status = e.response.status;
  const msg = String(e.response.data?.msg || e.response.data?.message || "").trim();

  if (status === 401 || /token missing|invalid token|authorization failed/i.test(msg)) {
    return "Please sign in — no valid session token";
  }
  if (/invalid password/i.test(msg)) return "Invalid password";
  const minMatch = msg.match(/minimum withdrawal is\s+(\d+(?:\.\d+)?)/i);
  if (minMatch) return `Minimum amount is $${minMatch[1]}`;
  if (/insufficient hybrid balance/i.test(msg)) return "Insufficient balance";

  return msg || fallback;
}

export default function WithdrawPage() {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [withdrawPassword, setWithdrawPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [toast, setToast] = useState("");
  const [toastTone, setToastTone] = useState<"neutral" | "success" | "error">("neutral");
  const [hybrid, setHybrid] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [detail, setDetail] = useState<any | null>(null);
  const [lastFetchAt, setLastFetchAt] = useState<number | null>(null);
  const [successBanner, setSuccessBanner] = useState<{ net: number; gross: number } | null>(null);

  const showToast = (msg: string, tone: "neutral" | "success" | "error" = "neutral") => {
    setToast(msg);
    setToastTone(tone);
    setTimeout(() => {
      setToast("");
      setToastTone("neutral");
    }, 2800);
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

  const vipLevel = Number(hybrid?.level ?? 0);

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
      setHybrid(hybridData);
      setWithdrawals(withdrawalData || []);
      setLastFetchAt(Date.now());
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

  const feeRateDisplay = useMemo(() => inferWithdrawFeeRate(withdrawals) * 100, [withdrawals]);

  const netPreview = useMemo(
    () => estimateWithdrawNetUsd(Number(amount || 0), withdrawals),
    [amount, withdrawals],
  );

  const withdraw = async () => {
    if (loading) return;
    setSubmitError("");

    const amt = Number(amount || 0);

    if (withdrawMin == null) {
      return showToast("Loading withdrawal rules…", "neutral");
    }

    if (!Number.isFinite(amt) || amt < withdrawMin) {
      return showToast(`Minimum amount is $${withdrawMin}`, "error");
    }

    if (amt > spendableHybridBalance) {
      return showToast("Insufficient balance", "error");
    }

    if (!isValidEvmAddress42(walletAddress.trim())) {
      return showToast("Enter a valid wallet: 0x + 40 hex characters (42 total)", "error");
    }

    if (!withdrawPassword.trim()) {
      return showToast("Enter password", "error");
    }

    try {
      setLoading(true);
      const payload = {
        amount: amt,
        walletAddress: walletAddress.trim(),
        password: withdrawPassword,
      };
      console.log("📤 Withdraw payload:", {
        amount: payload.amount,
        walletAddress: payload.walletAddress,
        password: payload.password ? "[redacted]" : "",
      });

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

      showToast("Withdrawal request submitted", "success");
      setAmount("");
      setWithdrawPassword("");
      await loadHybrid(true);
    } catch (err: any) {
      console.error("❌ Withdraw API error:", err);
      const msg = formatWithdrawSubmitError(err, getApiErrorMessage(err, "Request failed"));
      setSubmitError(msg);
      if (!suppressDuplicateCatchToast(err)) {
        showToast(msg, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const pendingNet = Number(pendingWithdrawal?.netAmount ?? pendingWithdrawal?.grossAmount ?? 0);

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

  if (dataLoading) {
    return (
      <ProtectedRoute>
        <WithdrawPageSkeleton />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="relative w-full max-w-lg pb-4 text-white">
        <AppToast message={toast} tone={toastTone} />

        <div className="relative z-10 mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-400/80">
              Secure payout
            </p>
            <h1 className="mt-1 bg-gradient-to-r from-emerald-300 via-green-300 to-blue-400 bg-clip-text text-2xl font-black text-transparent sm:text-3xl">
              Withdraw
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <VipBadge level={vipLevel} showGlow={vipLevel >= 1} />
              <span className="text-[11px] text-gray-500">BEP20 · USDT</span>
            </div>
          </div>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
            <LiveRefreshIndicator lastUpdatedAt={lastFetchAt} />
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="min-h-[44px] rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-gray-200 shadow-soft transition hover:border-emerald-500/30 hover:bg-emerald-500/10 active:scale-[0.98]"
            >
              Back
            </button>
          </div>
        </div>

        {loadError ? (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {loadError}
          </div>
        ) : null}

        {submitError ? (
          <div
            role="alert"
            className="mb-4 rounded-2xl border border-red-500/35 bg-red-500/[0.14] px-4 py-3 text-sm font-medium text-red-50 shadow-[0_8px_32px_rgba(220,38,38,0.12)] ring-1 ring-red-400/25"
          >
            {submitError}
          </div>
        ) : null}

        {successBanner ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.12] px-4 py-3 text-sm text-emerald-50 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)] ring-1 ring-emerald-400/25"
          >
            <p className="font-bold text-emerald-100">
              Withdrawal queued — est. you receive{" "}
              <span className="tabular-nums">${successBanner.net.toFixed(2)} USDT</span>
              <span className="font-normal text-emerald-200/90">
                {" "}
                (from ${successBanner.gross.toFixed(2)} gross)
              </span>
            </p>
            <p className="mt-1 text-xs text-emerald-200/85">
              Funds move through review and payout. Track progress below.
            </p>
          </motion.div>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/15 via-[#0f1629] to-blue-600/10 p-6 shadow-glow-emerald"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
          <p className="relative text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200/80">
            Available balance
          </p>
          <p className="relative mt-2 text-4xl font-black tabular-nums text-white">
            ${spendableHybridBalance.toFixed(2)}
          </p>
          <p className="relative mt-2 text-xs text-gray-400">Deposit + reward balance (hybrid)</p>
        </motion.div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
              Pending (net)
            </p>
            <p className="mt-2 text-lg font-bold text-amber-200 tabular-nums">
              {pendingWithdrawal ? `$${pendingNet.toFixed(2)}` : "—"}
            </p>
          </Card>
          <CountdownTimer
            targetTime={cooldownTarget ? new Date(cooldownTarget).toISOString() : null}
            label={lockHours != null ? `${lockHours}h Cooldown` : "Cooldown"}
            completeText={timerSource ? "Window complete" : "No timer"}
            className="bg-card h-full shadow-soft backdrop-blur-xl"
          />
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
          <Card>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">Submit withdrawal</h2>
                <p className="mt-1 text-xs text-gray-500">Password confirms this device session.</p>
              </div>
              <VipBadge level={vipLevel} showGlow={vipLevel >= 1} />
            </div>

            <div className="space-y-4">
              <Input
                label={`Amount (USDT) · min ${withdrawMin != null ? `$${withdrawMin}` : "…"}`}
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                disabled={loading}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
              />
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3 text-sm shadow-inner ring-1 ring-emerald-500/15">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
                  You will receive (est.)
                </p>
                <p className="mt-1 text-lg font-black tabular-nums text-emerald-100">
                  {Number(amount || 0) > 0 ? `${netPreview.toFixed(2)} USDT` : "—"}
                </p>
                <p className="mt-1 text-[11px] text-emerald-200/75">
                  Est. <span className="tabular-nums">{feeRateDisplay.toFixed(2)}</span>% fee inferred from
                  your history — final net is confirmed on payout.
                </p>
              </div>
              <Input
                label="Wallet address"
                autoComplete="off"
                placeholder="0x…"
                value={walletAddress}
                disabled={loading}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setWalletAddress(e.target.value)}
                hint="BEP20 USDT — 0x + 40 hex characters."
              />
              <Input
                label="Account password"
                type="password"
                placeholder="••••••••"
                value={withdrawPassword}
                disabled={loading}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setWithdrawPassword(e.target.value)}
              />
            </div>

            <Button
              type="button"
              className="mt-6"
              size="lg"
              loading={loading}
              disabled={loading || withdrawMin == null}
              onClick={() => void withdraw()}
            >
              {loading ? "Processing request…" : "Submit withdrawal"}
            </Button>
          </Card>
        </motion.div>

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white">Withdrawal history</h3>
            <span className="text-[10px] text-gray-500">Auto-refresh · syncs regularly</span>
          </div>

          {withdrawals.length === 0 ? (
            <EmptyState
              title="No withdrawals yet"
              text="Withdraw to your wallet when your balance qualifies. Estimated fees show before you submit."
              className="bg-card shadow-soft backdrop-blur-xl"
              action={{
                label: "View balance → Deposit",
                onClick: () => router.push("/deposit"),
              }}
            />
          ) : (
            <div className="space-y-3">
              {withdrawals.map((w) => {
                const variant = getWithdrawalBadgeVariant(w.status);
                const net = Number(w.netAmount ?? 0);
                const addr = w.walletAddress ? maskAddress(String(w.walletAddress)) : "—";
                return (
                  <motion.div key={w._id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="!p-4 transition hover:border-white/[0.12]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <p className="text-lg font-bold tabular-nums text-white">${net.toFixed(2)}</p>
                          <p className="truncate font-mono text-[11px] text-gray-500">{addr}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={variant}>{getWithdrawalStatusLabel(w.status)}</Badge>
                            <span className="text-[10px] text-gray-500">
                              {w.createdAt ? new Date(w.createdAt).toLocaleString() : ""}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDetail(w)}
                          className="min-h-[44px] rounded-2xl border border-blue-500/35 bg-blue-500/10 px-4 py-3 text-xs font-semibold text-blue-100 transition hover:bg-blue-500/20 active:scale-[0.98]"
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

        <Card className="mt-6 border-amber-500/15 bg-amber-500/[0.06]">
          <p className="text-sm font-semibold text-amber-200">Important</p>
          <ul className="mt-3 space-y-2 text-xs text-gray-400">
            <li>
              Minimum:{" "}
              {withdrawMin != null ? `$${withdrawMin} USDT (net is after platform fee)` : "…"}
            </li>
            <li>Review and on-chain payout are handled after the lock window.</li>
            <li>
              Cooldown:{" "}
              {lockHours != null ? `${lockHours} hours between requests (when applicable)` : "…"}
            </li>
          </ul>
        </Card>

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
