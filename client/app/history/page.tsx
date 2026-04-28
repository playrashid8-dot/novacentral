"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import API from "../../lib/api";
import { fetchHybridSummary, fetchHybridWithdrawals } from "../../lib/hybrid";
import { logout } from "../../lib/auth";
import BottomNav from "../../components/BottomNav";
import ProtectedRoute from "../../components/ProtectedRoute";
import GlassCard from "../../components/GlassCard";

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
      const [res, hybridData, withdrawalData] = await Promise.all([
        API.get("/history").catch(() => ({ data: { data: [] } })),
        fetchHybridSummary().catch(() => null),
        fetchHybridWithdrawals().catch(() => []),
      ]);

      const legacyHistory = Array.isArray(res.data?.data)
        ? res.data.data
        : (res.data?.data?.history ?? res.data?.history ?? []);
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
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading...
      </div>
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
    <div className="min-h-screen max-w-[420px] mx-auto px-4 pb-28 text-white relative">

      {/* HEADER */}
      <div className="flex justify-between items-center pt-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-purple-300/70">Real Records</p>
          <h1 className="text-2xl font-black bg-gradient-to-r from-purple-300 via-fuchsia-300 to-blue-300 bg-clip-text text-transparent">History</h1>
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-gray-400"
        >
          Back
        </button>
      </div>

      <GlassCard glow="purple" className="mt-5">
        <div className="grid grid-cols-4 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-2 py-2 text-[11px] font-semibold transition ${
                activeTab === tab.key
                  ? "bg-purple-500 text-white shadow-[0_0_18px_rgba(168,85,247,0.45)]"
                  : "bg-white/[0.06] text-gray-400"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </GlassCard>

      <div className="mt-5 space-y-3">

        {filtered.length === 0 && (
          <p className="text-center text-gray-500 mt-10">
            No {tabs.find((tab) => tab.key === activeTab)?.label.toLowerCase()} records yet
          </p>
        )}

        {filtered.map((item, i) => (
          <div
            key={item._id || i}
            className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-2xl"
          >
            <div className="flex justify-between items-center">

              {/* TYPE */}
              <span className={`text-sm font-semibold ${getTypeColor(item.type)}`}>
                {String(item.type || activeTab).toUpperCase()}
              </span>

              {/* STATUS */}
              <span className={`text-xs ${getRowStatusColor(item)}`}>
                {formatHistoryStatus(item)}
              </span>
            </div>

            {/* AMOUNT */}
            <p className="text-lg font-bold mt-1 text-green-400">
              $
              {Number(
                item.type === "withdrawal" || String(item.type || "").includes("withdraw")
                  ? item.netAmount ?? item.amount
                  : item.amount || item.totalReward || 0
              ).toFixed(2)}
              {item.type === "withdrawal" && item.grossAmount != null ? (
                <span className="ml-1 text-xs font-normal text-gray-500">
                  (net · gross ${Number(item.grossAmount).toFixed(2)})
                </span>
              ) : null}
            </p>

            {/* DATE */}
            <p className="text-xs text-gray-500 mt-1">
              {item.createdAt ? new Date(item.createdAt).toLocaleString() : "No date"}
            </p>
          </div>
        ))}

      </div>

      <BottomNav />
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

/* 🎨 STATUS COLOR */
function getStatusColor(status: string) {
  switch (status) {
    case "approved":
    case "paid":
    case "claimed":
    case "success":
    case "swept":
      return "text-green-400";
    case "pending":
    case "credited":
      return "text-yellow-400";
    case "rejected":
      return "text-red-400";
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

function getRowStatusColor(item: any) {
  const t = String(item.type || "").toLowerCase();
  if (t.includes("deposit")) {
    if (item.confirmationStatus === "confirmed") return "text-emerald-300";
    if (item.confirmationStatus === "confirming") return "text-amber-200";
  }
  return getStatusColor(item.status);
}