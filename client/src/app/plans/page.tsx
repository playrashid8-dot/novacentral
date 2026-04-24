"use client";

import { motion } from "framer-motion";

export default function Plans() {

  const plans = [
    { name: "Starter", days: 4, profit: "5%", color: "from-purple-500 to-indigo-500" },
    { name: "Advance", days: 7, profit: "10%", color: "from-blue-500 to-cyan-500" },
    { name: "Pro", days: 15, profit: "20%", color: "from-green-500 to-emerald-500" },
    { name: "VIP", days: 30, profit: "45%", color: "from-yellow-500 to-orange-500" },
  ];

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
                Profit: {plan.profit}
              </p>

              <button className="mt-4 w-full btn">
                Invest Now
              </button>

            </div>
          </motion.div>
        ))}

      </div>

    </div>
  );
}