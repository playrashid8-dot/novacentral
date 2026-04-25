"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import API from "../../lib/api";
import { getUser } from "../../lib/auth";
import { useRouter } from "next/navigation";

export default function Investment() {
  const router = useRouter();

  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [user, setUser]: any = useState(null);

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
    if (loadingPlan) return;

    const amt = Number(amount);

    if (!amt || amt < 10) {
      return alert("Minimum investment is $10");
    }

    if (amt > (user?.balance || 0)) {
      return alert("Insufficient balance");
    }

    try {
      setLoadingPlan(selectedPlan.key);

      await API.post("/investment", {
        amount: amt,
        plan: selectedPlan.key,
      });

      alert("Investment started 🚀");

      // reset
      setSelectedPlan(null);
      setAmount("");

      // 🔄 optional refresh
      router.refresh?.();

    } catch (err: any) {
      alert(err?.response?.data?.msg || "Investment failed ❌");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 text-white">

      <h1 className="text-xl font-bold mb-5">📊 Investment Plans</h1>

      <div className="space-y-4">

        {plans.map((plan, i) => (
          <motion.div
            key={i}
            whileHover={{ scale: 1.03 }}
            className={`p-[1px] rounded-2xl bg-gradient-to-r ${plan.color}`}
          >
            <div className="bg-[#0b0b0f] p-5 rounded-2xl">

              <h2 className="font-bold text-lg">{plan.name}</h2>

              <p className="text-gray-400 text-sm mt-1">
                Duration: {plan.days} Days
              </p>

              <p className="text-green-400 font-semibold mt-2">
                Daily ROI: {plan.roi}%
              </p>

              <p className="text-xs text-gray-500 mt-1">
                Total ≈ {(plan.roi * plan.days).toFixed(1)}%
              </p>

              <button
                onClick={() => setSelectedPlan(plan)}
                className="mt-4 w-full btn"
              >
                Invest Now
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
            className="w-full max-w-sm bg-[#0b0b0f] p-5 rounded-2xl border border-white/10"
          >
            <h2 className="font-bold text-lg mb-3">
              Invest in {selectedPlan.name}
            </h2>

            <p className="text-sm text-gray-400 mb-2">
              Balance: ${Number(user?.balance || 0).toFixed(2)}
            </p>

            <input
              type="number"
              placeholder="Enter Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input w-full"
            />

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setSelectedPlan(null)}
                className="w-full btn-secondary"
              >
                Cancel
              </button>

              <button
                onClick={confirmInvest}
                disabled={loadingPlan === selectedPlan.key}
                className="w-full btn flex justify-center items-center gap-2"
              >
                {loadingPlan === selectedPlan.key && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Confirm
              </button>
            </div>
          </motion.div>

        </div>
      )}

    </div>
  );
}