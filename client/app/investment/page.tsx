"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import API, { getApiErrorMessage } from "../../lib/api";
import { getUser } from "../../lib/auth";
import { useRouter } from "next/navigation";
import ProtectedRoute from "../../components/ProtectedRoute";
import AppToast from "../../components/AppToast";

export default function Investment() {
  const router = useRouter();

  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [user, setUser]: any = useState(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const plans = [
    { name: "Basic", key: "basic", days: 30, roi: 1, color: "from-purple-500 to-indigo-500" },
    { name: "Silver", key: "silver", days: 45, roi: 1.5, color: "from-blue-500 to-cyan-500" },
    { name: "Gold", key: "gold", days: 60, roi: 2, color: "from-green-500 to-emerald-500" },
    { name: "VIP", key: "vip", days: 90, roi: 2.5, color: "from-yellow-500 to-orange-500" },
  ];

  // 🔐 USER LOAD
  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);
  }, []);

  // 🚀 INVEST
  const confirmInvest = async () => {
    const amt = Number(amount);

    if (!amt || amt < 10) return showToast("Minimum investment is $10");
    if (amt > (user?.balance || 0)) return showToast("Insufficient balance");

    try {
      setLoadingPlan(selectedPlan.key);

      await API.post("/investment", {
        amount: amt,
        plan: selectedPlan.key,
      });

      showToast("Investment started 🚀");

      setSelectedPlan(null);
      setAmount("");

      router.refresh?.();

    } catch (err: any) {
      showToast(getApiErrorMessage(err, "Investment failed ❌"));
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <ProtectedRoute>
    <div className="min-h-screen max-w-[420px] mx-auto px-4 py-6 text-white relative bg-[#040406]">
      <AppToast message={toast} />

      {/* 🌌 BACKGROUND */}
      <div className="absolute w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[150px] top-[-150px] left-[-150px]" />
      <div className="absolute w-[500px] h-[500px] bg-indigo-600 opacity-20 blur-[150px] bottom-[-150px] right-[-150px]" />

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 relative z-10">
        <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
          Investment Plans 📊
        </h1>

        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-purple-400"
        >
          Back
        </button>
      </div>

      {/* BALANCE */}
      <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center mb-6">
        <p className="text-xs text-gray-400">Available Balance</p>
        <h2 className="text-3xl font-bold text-green-400">
          ${Number(user?.balance || 0).toFixed(2)}
        </h2>
      </div>

      {/* PLANS */}
      <div className="space-y-4 relative z-10">

        {plans.map((plan) => (
          <motion.div
            key={plan.key}
            whileHover={{ scale: 1.03 }}
            className={`p-[1px] rounded-2xl bg-gradient-to-r ${plan.color}`}
          >
            <div className="bg-[#0b0b0f] p-5 rounded-2xl">

              <div className="flex justify-between items-center">
                <h2 className="font-bold text-lg">{plan.name}</h2>
                <span className="text-xs bg-white/10 px-2 py-1 rounded-lg">
                  {plan.days}D
                </span>
              </div>

              <p className="text-green-400 font-semibold mt-2 text-lg">
                {plan.roi}% / day
              </p>

              <p className="text-xs text-gray-400 mt-1">
                Total Return ≈ {(plan.roi * plan.days).toFixed(1)}%
              </p>

              {/* ROI BAR */}
              <div className="w-full bg-white/5 h-2 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                  style={{ width: `${plan.roi * 20}%` }}
                />
              </div>

              <button
                onClick={() => setSelectedPlan(plan)}
                className="mt-4 w-full bg-gradient-to-r from-purple-500 to-indigo-500 p-2 rounded-xl text-sm font-semibold"
              >
                Invest Now 🚀
              </button>

            </div>
          </motion.div>
        ))}

      </div>

      {/* 🔥 MODAL */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4 z-50">

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm p-[1px] rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500"
          >
            <div className="bg-[#0b0b0f] p-5 rounded-2xl">

              <h2 className="font-bold text-lg mb-2">
                Invest in {selectedPlan.name}
              </h2>

              <p className="text-xs text-gray-400 mb-3">
                Balance: ${Number(user?.balance || 0).toFixed(2)}
              </p>

              {/* QUICK AMOUNTS */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[10, 50, 100].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(String(val))}
                    className="bg-white/5 p-2 rounded-lg text-xs"
                  >
                    ${val}
                  </button>
                ))}
              </div>

              <input
                type="number"
                placeholder="Enter Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-sm"
              />

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="w-full bg-white/5 p-2 rounded-xl text-sm"
                >
                  Cancel
                </button>

                <button
                  onClick={confirmInvest}
                  disabled={loadingPlan === selectedPlan.key}
                  className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 p-2 rounded-xl text-sm flex justify-center items-center gap-2"
                >
                  {loadingPlan === selectedPlan.key && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  Confirm 🚀
                </button>
              </div>

            </div>
          </motion.div>

        </div>
      )}

    </div>
    </ProtectedRoute>
  );
}