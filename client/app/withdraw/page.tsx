"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import ProtectedRoute from "../../components/ProtectedRoute";
import AppToast from "../../components/AppToast";
import CountdownTimer from "../../components/CountdownTimer";
import { getApiErrorMessage, suppressDuplicateCatchToast } from "../../lib/api";
import { fetchHybridSummary, fetchHybridWithdrawals, requestHybridWithdraw } from "../../lib/hybrid";
import { maskAddress, isValidEvmAddress42 } from "../../lib/helpers";
import { getWithdrawalBadgeVariant, getWithdrawalStatusLabel } from "../../lib/withdrawUi";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import VipBadge from "../../components/ui/VipBadge";
import Loader from "../../components/ui/Loader";

const activePendingStatuses = ["pending", "claimable", "approved"];

export default function WithdrawPage() {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [withdrawPassword, setWithdrawPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");
  const [hybrid, setHybrid] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [detail, setDetail] = useState<any | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
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

    if (!isValidEvmAddress42(walletAddress.trim())) {
      return showToast("Enter a valid wallet: 0x + 40 hex characters (42 total)");
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

      showToast("Withdrawal submitted successfully");
      setAmount("");
      setWithdrawPassword("");
      await loadHybrid(true);
    } catch (err: any) {
      if (!suppressDuplicateCatchToast(err)) {
        showToast(getApiErrorMessage(err, "Request failed"));
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

    return (
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-gray-400">Status</span>
          <Badge variant={variant}>{label}</Badge>
        </div>
        <Row label="Amount (gross)" value={`${gross.toFixed(2)} USDT`} />
        <Row label="Fee" value={`${fee.toFixed(2)} USDT`} />
        <Row label="You receive (net)" value={`${net.toFixed(2)} USDT`} highlight />
        <Row
          label="Address"
          value={detail.walletAddress ? String(detail.walletAddress) : "—"}
          mono
        />
        {detail.txHash ? (
          <Row label="TX hash" value={String(detail.txHash)} mono />
        ) : (
          <p className="text-xs text-gray-500">TX hash appears after payout is recorded.</p>
        )}
      </div>
    );
  }, [detail]);

  if (dataLoading) {
    return (
      <ProtectedRoute>
        <Loader label="Loading withdraw…" />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="relative w-full max-w-lg pb-4 text-white">
        <AppToast message={toast} />

        <div className="relative z-10 mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-400/80">
              Secure payout
            </p>
            <h1 className="mt-1 bg-gradient-to-r from-emerald-300 via-green-300 to-blue-400 bg-clip-text text-2xl font-black text-transparent sm:text-3xl">
              Withdraw
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <VipBadge level={vipLevel} />
              <span className="text-[11px] text-gray-500">BEP20 · USDT</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-gray-200 shadow-soft transition hover:border-emerald-500/30 hover:bg-emerald-500/10"
          >
            Back
          </button>
        </div>

        {loadError ? (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {loadError}
          </div>
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
              <VipBadge level={vipLevel} />
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
              <Input
                label="Wallet address"
                autoComplete="off"
                placeholder="0x…"
                value={walletAddress}
                disabled={loading}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWalletAddress(e.target.value)}
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
              Submit withdrawal
            </Button>
          </Card>
        </motion.div>

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white">Withdrawal history</h3>
            <span className="text-[10px] text-gray-500">Auto-refresh ~16s</span>
          </div>

          {withdrawals.length === 0 ? (
            <Card>
              <p className="py-10 text-center text-sm text-gray-500">No withdrawals yet.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((w) => {
                const variant = getWithdrawalBadgeVariant(w.status);
                const net = Number(w.netAmount ?? 0);
                const addr = w.walletAddress ? maskAddress(String(w.walletAddress)) : "—";
                return (
                  <Card key={w._id} className="!p-4">
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
                        className="rounded-2xl border border-blue-500/35 bg-blue-500/10 px-4 py-3 text-xs font-semibold text-blue-100 transition hover:bg-blue-500/20"
                      >
                        View
                      </button>
                    </div>
                  </Card>
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
              {withdrawMin != null
                ? `$${withdrawMin} USDT (net is after platform fee)`
                : "…"}
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
