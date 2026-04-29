"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import API, { normalize } from "../../lib/api";
import { fetchHybridSummary, fetchHybridWithdrawals } from "../../lib/hybrid";
import { logout } from "../../lib/auth";
import ProtectedRoute from "../../components/ProtectedRoute";
import GlassCard from "../../components/GlassCard";
import PageSkeleton from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";
import StatusBadge, { tierFromHistoryItem } from "../../components/StatusBadge";

export default function History() {
  const router = useRouter();

  const [data, setData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("deposits");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const [raw, hybridData, withdrawalData] = await Promise.all([
        API.get("/history").catch(() => ({ data: {} })),
        fetchHybridSummary().catch(() => null),
        fetchHybridWithdrawals().catch(() => []),
      ]);

      const body = raw?.data || {};
      const envelope = normalize(body);
      const d = envelope.data as any;
      let legacyHistory: any[] = [];
      if (Array.isArray(d)) legacyHistory = d;
      else if (d && Array.isArray(d.history)) legacyHistory = d.history;
      else if (Array.isArray(body.history)) legacyHistory = body.history;
      const deposits = (hybridData?.deposits || []).map((item: any) => ({
        ...item,
        type: "deposit",
        status: item.status || "credited",
      }));
      const withdrawals = (withdrawalData || []).map((item: any) => ({
        ...item,
        type: "withdrawal",
        status: item.status || "pending",
      }));

      setData([...deposits, ...withdrawals, ...legacyHistory]);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="w-full px-3 pb-24 pt-2 sm:px-6" aria-busy aria-label="Loading history">
          <PageSkeleton />
        </div>
      </ProtectedRoute>
    );
  }

  const tabs = [
    { key: "deposits", label: "Deposits" },
    { key: "withdrawals", label: "Withdrawals" },
    { key: "roi", label: "ROI" },
    { key: "referral", label: "Referral" },
  ];

  const filtered = data
    .filter((item) => {
      const type = String(item.type || item.source || item.note || "").toLowerCase();
      if (activeTab === "deposits") return type.includes("deposit");
      if (activeTab === "withdrawals") return type.includes("withdraw");
      if (activeTab === "roi") return type.includes("roi");
      if (activeTab === "referral") return type.includes("referral");
      return true;
    })
    .sort((a, b) => new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime());

  return (
    <ProtectedRoute>
    <div className="relative w-full max-w-full overflow-x-hidden pb-24 text-white">

      {/* HEADER */}
      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-indigo-300/80">
            Transactions
          </p>
          <h1 className="mt-1 bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-2xl font-black text-transparent">
            History
          </h1>
        </div>

        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="w-full rounded-2xl border border-white/[0.1] bg-[#111827] px-4 py-2.5 text-sm font-semibold text-gray-300 shadow-md transition hover:scale-[1.02] sm:w-auto"
        >
          Back
        </button>
      </div>

      <GlassCard glow="purple" className="mt-5 border-[#6366F1]/15">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-2 py-2.5 text-[11px] font-semibold transition ${
                activeTab === tab.key
                  ? "bg-[#6366F1] text-white shadow-[0_0_24px_rgba(99,102,241,0.35)]"
                  : "bg-white/[0.06] text-gray-400 hover:bg-white/[0.09]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </GlassCard>

      <div className="mt-6">
        {filtered.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            text={`No ${tabs.find((tab) => tab.key === activeTab)?.label.toLowerCase() ?? "matching"} records yet`}
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111827]/70 ring-1 ring-white/[0.05]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.07] bg-black/30 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    <th className="whitespace-nowrap px-4 py-3">Type</th>
                    <th className="whitespace-nowrap px-4 py-3">Amount</th>
                    <th className="whitespace-nowrap px-4 py-3">Status</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, i) => {
                    const amt = Number(
                      item.type === "withdrawal" || String(item.type || "").includes("withdraw")
                        ? item.netAmount ?? item.amount
                        : item.amount || item.totalReward || 0
                    );
                    const tier = tierFromHistoryItem(item);

                    return (
                      <motion.tr
                        key={item._id || i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.35) }}
                        className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.03]"
                      >
                        <td className="px-4 py-3 align-middle">
                          <span className={`text-xs font-bold ${getTypeColor(item.type)}`}>
                            {String(item.type || activeTab).toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle font-semibold tabular-nums text-white">
                          ${amt.toFixed(2)}
                          {item.type === "withdrawal" && item.grossAmount != null ? (
                            <span className="mt-0.5 block text-[10px] font-normal text-gray-500">
                              Gross ${Number(item.grossAmount).toFixed(2)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <StatusBadge tier={tier}>{shortStatusLabel(item)}</StatusBadge>
                          <p className="mt-1 max-w-[200px] truncate text-[10px] text-gray-500">
                            {formatHistoryStatus(item)}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-middle text-right text-xs text-gray-400 tabular-nums">
                          {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
    </ProtectedRoute>
  );
}

/* 🎨 TYPE COLOR */
function getTypeColor(type: string) {
  switch (type) {
    case "deposit":
      return "text-green-400";
    case "withdraw":
    case "withdrawal":
      return "text-red-400";
    case "roi":
      return "text-cyan-400";
    case "referral":
      return "text-yellow-300";
    case "investment":
      return "text-blue-400";
    default:
      return "text-gray-400";
  }
}

function formatHistoryStatus(item: any) {
  const t = String(item.type || "").toLowerCase();
  if (t.includes("deposit") && item.confirmationStatus) {
    const chain =
      item.confirmationStatus === "confirmed"
        ? "✅ confirmed"
        : item.confirmationStatus === "confirming"
          ? "⏳ confirming"
          : null;
    const base = item.status || "credited";
    return chain ? `${chain} · ${base}` : base;
  }
  return item.status;
}

function shortStatusLabel(item: any) {
  const tier = tierFromHistoryItem(item);
  if (tier === "success") return "Confirmed";
  if (tier === "warning") return "Pending";
  if (tier === "danger") return "Failed";
  const raw = String(item.status ?? "—");
  return raw.length > 22 ? `${raw.slice(0, 20)}…` : raw;
}