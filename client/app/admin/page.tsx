"use client";

import { useEffect, useState } from "react";
import API, { getApiErrorMessage } from "../../lib/api";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import ProtectedRoute from "../../components/ProtectedRoute";
import AppToast from "../../components/AppToast";

export default function AdminPage() {
  const router = useRouter();

  const [tab, setTab] = useState("deposits");
  const [data, setData]: any = useState([]);
  const [stats, setStats]: any = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  useEffect(() => {
    loadData();
    loadStats();
  }, [tab]);

  const loadData = async () => {
    try {
      setLoading(true);

      let url = "";

      if (tab === "deposits") url = "/admin/deposits/pending";
      if (tab === "withdrawals") url = "/admin/withdrawals/pending";
      if (tab === "users") url = "/admin/users";

      const res = await API.get(url);
      setData(res.data.deposits || res.data.withdrawals || res.data.users);

    } catch (err: any) {
      showToast(getApiErrorMessage(err, "Failed to load admin data ❌"));
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await API.get("/admin/stats");
      setStats(res.data.stats);
    } catch {}
  };

  // 🔥 ACTIONS
  const runAction = async (label: string, action: () => Promise<any>) => {
    try {
      await action();
      showToast(`${label} successful ✅`);
      loadData();
      loadStats();
    } catch (err: any) {
      showToast(getApiErrorMessage(err, `${label} failed ❌`));
      loadData();
      loadStats();
    }
  };

  const approveDeposit = async (id: string) => {
    if (actionLoadingId) return;
    setActionLoadingId(id);
    setData((prev: any[]) => prev.filter((item) => item._id !== id));
    await runAction("Deposit approval", () => API.post(`/admin/approve-deposit/${id}`));
    setActionLoadingId("");
  };

  const rejectDeposit = async (id: string) => {
    if (actionLoadingId) return;
    setActionLoadingId(id);
    setData((prev: any[]) => prev.filter((item) => item._id !== id));
    await runAction("Deposit rejection", () => API.post(`/admin/reject-deposit/${id}`));
    setActionLoadingId("");
  };

  const approveWithdrawal = async (id: string) => {
    if (actionLoadingId) return;
    setActionLoadingId(id);
    setData((prev: any[]) => prev.filter((item) => item._id !== id));
    await runAction("Withdrawal approval", () => API.post(`/admin/approve-withdrawal/${id}`));
    setActionLoadingId("");
  };

  const rejectWithdrawal = async (id: string) => {
    if (actionLoadingId) return;
    setActionLoadingId(id);
    setData((prev: any[]) => prev.filter((item) => item._id !== id));
    await runAction("Withdrawal rejection", () => API.post(`/admin/reject-withdrawal/${id}`));
    setActionLoadingId("");
  };

  const blockUser = async (id: string) => {
    await runAction("User block", () => API.post(`/admin/block/${id}`));
  };

  const unblockUser = async (id: string) => {
    await runAction("User unblock", () => API.post(`/admin/unblock/${id}`));
  };

  const resetWallet = async (id: string) => {
    if (!confirm("Reset wallet?")) return;
    await runAction("Wallet reset", () => API.post(`/admin/reset-wallet/${id}`));
  };

  return (
    <ProtectedRoute adminOnly>
    <div className="min-h-screen bg-[#040406] text-white px-4 py-6">
      <AppToast message={toast} />

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-purple-400">⚙️ Admin Panel</h1>
        <button onClick={() => router.push("/dashboard")} className="text-sm text-gray-400">
          Back
        </button>
      </div>

      {/* 📊 STATS */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-6 text-center">

          <Stat title="Users" value={stats.totalUsers} />
          <Stat title="Deposits" value={stats.totalDeposits} />
          <Stat title="Withdrawals" value={stats.totalWithdrawals} />
          <Stat title="Balance" value={`$${stats.totalBalance}`} />

        </div>
      )}

      {/* 🔘 TABS */}
      <div className="flex gap-2 mb-5">

        <TabBtn label="Deposits" active={tab==="deposits"} onClick={()=>setTab("deposits")} />
        <TabBtn label="Withdraw" active={tab==="withdrawals"} onClick={()=>setTab("withdrawals")} />
        <TabBtn label="Users" active={tab==="users"} onClick={()=>setTab("users")} />

      </div>

      {/* 📄 DATA */}
      {loading ? (
        <p className="text-center text-gray-400">Loading...</p>
      ) : (
        <div className="space-y-3">

          {data.map((item: any) => (
            <motion.div
              key={item._id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white/5 p-4 rounded-xl border border-white/10"
            >

              {/* USER INFO */}
              <p className="text-sm">
                {item.userId?.username || "User"}
              </p>

              <p className="text-xs text-gray-400">
                {item.userId?.email}
              </p>

              {/* AMOUNT */}
              <h3 className="text-lg text-green-400 mt-1">
                ${item.amount || 0}
              </h3>

              {/* ACTIONS */}
              {tab === "deposits" && (
                <div className="flex gap-2 mt-3">
                  <Btn
                    text="Approve"
                    color="bg-green-500"
                    disabled={Boolean(actionLoadingId)}
                    onClick={() => approveDeposit(item._id)}
                  />
                  <Btn
                    text="Reject"
                    color="bg-red-500"
                    disabled={Boolean(actionLoadingId)}
                    onClick={() => rejectDeposit(item._id)}
                  />
                </div>
              )}

              {tab === "withdrawals" && (
                <div className="flex gap-2 mt-3">
                  <Btn
                    text="Approve"
                    color="bg-green-500"
                    disabled={Boolean(actionLoadingId)}
                    onClick={() => approveWithdrawal(item._id)}
                  />
                  <Btn
                    text="Reject"
                    color="bg-red-500"
                    disabled={Boolean(actionLoadingId)}
                    onClick={() => rejectWithdrawal(item._id)}
                  />
                </div>
              )}

              {tab === "users" && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  <Btn text="Block" color="bg-red-500" onClick={()=>blockUser(item._id)} />
                  <Btn text="Unblock" color="bg-green-500" onClick={()=>unblockUser(item._id)} />
                  <Btn text="Reset" color="bg-yellow-500" onClick={()=>resetWallet(item._id)} />
                </div>
              )}

            </motion.div>
          ))}

        </div>
      )}

    </div>
    </ProtectedRoute>
  );
}

/* 🔹 STAT */
function Stat({ title, value }: any) {
  return (
    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
      <p className="text-xs text-gray-400">{title}</p>
      <h3 className="text-purple-400 font-bold">{value}</h3>
    </div>
  );
}

/* 🔹 BUTTON */
function Btn({ text, color, onClick, disabled = false }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${color} px-3 py-1 rounded text-xs disabled:opacity-60 disabled:cursor-not-allowed`}
    >
      {text}
    </button>
  );
}

/* 🔹 TAB */
function TabBtn({ label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-xs ${
        active
          ? "bg-purple-500"
          : "bg-white/10 text-gray-400"
      }`}
    >
      {label}
    </button>
  );
}