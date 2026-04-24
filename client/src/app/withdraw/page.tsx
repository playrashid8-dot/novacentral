"use client";

import { useState, useEffect } from "react";

export default function WithdrawPage() {
  const [amount, setAmount] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // ⏳ FAKE TIMER (96 HOURS = 345600 sec)
  useEffect(() => {
    if (cooldown <= 0) return;

    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldown]);

  const handleWithdraw = () => {
    if (!amount) return alert("Enter amount");

    setCooldown(345600); // 96 hours
    alert("Withdraw request submitted");
  };

  // FORMAT TIME
  const formatTime = () => {
    const h = Math.floor(cooldown / 3600);
    const m = Math.floor((cooldown % 3600) / 60);
    const s = cooldown % 60;
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white px-4 pb-24">

      {/* HEADER */}
      <h1 className="text-xl font-bold pt-5">🏦 Withdraw</h1>

      {/* BALANCE CARD */}
      <div className="mt-5 rounded-3xl p-[1px] bg-gradient-to-r from-purple-500 to-indigo-500">
        <div className="bg-[#0b0b0f] rounded-3xl p-5">

          <p className="text-gray-400">Available Balance</p>
          <h2 className="text-3xl font-bold mt-1">$1,250.00</h2>

        </div>
      </div>

      {/* INPUT */}
      <div className="mt-6">
        <input
          type="number"
          placeholder="Enter amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full p-4 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-purple-500"
        />
      </div>

      {/* BUTTON */}
      <button
        onClick={handleWithdraw}
        disabled={cooldown > 0}
        className={`mt-4 w-full p-4 rounded-xl font-semibold transition ${
          cooldown > 0
            ? "bg-gray-700 cursor-not-allowed"
            : "bg-gradient-to-r from-purple-500 to-indigo-500 hover:scale-105"
        }`}
      >
        {cooldown > 0 ? "Locked 🔒" : "Withdraw Now"}
      </button>

      {/* TIMER */}
      {cooldown > 0 && (
        <div className="mt-4 text-center text-yellow-400">
          ⏳ Next withdraw in: {formatTime()}
        </div>
      )}

      {/* HISTORY */}
      <div className="mt-8">
        <h2 className="font-semibold mb-3">Withdraw History</h2>

        <div className="bg-[#0b0b0f] p-4 rounded-xl flex justify-between">
          <span>$300</span>
          <span className="text-yellow-400">Pending</span>
        </div>

        <div className="bg-[#0b0b0f] p-4 rounded-xl flex justify-between mt-2">
          <span>$150</span>
          <span className="text-green-400">Completed</span>
        </div>

      </div>

    </div>
  );
}