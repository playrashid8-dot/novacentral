"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export default function WithdrawPage() {
  const [amount, setAmount] = useState("");
  const [wallet, setWallet] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const fee = amount ? Number(amount) * 0.05 : 0;
  const receive = amount ? Number(amount) - fee : 0;

  const handleWithdraw = () => {
    if (!amount || !wallet || !password || !otp) {
      alert("Fill all fields");
      return;
    }

    if (Number(amount) < 30) {
      alert("Minimum withdrawal is 30 USDT");
      return;
    }

    alert("Withdraw request submitted 🚀");
  };

  return (
    <div className="min-h-screen px-4 pb-28 text-white glow-bg relative">

      {/* HEADER */}
      <div className="pt-5 flex justify-between items-center">
        <h1 className="text-xl font-bold text-glow">🏦 Withdraw</h1>
        <span className="text-xs text-gray-400">Secure System 🔐</span>
      </div>

      {/* BALANCE */}
      <div className="mt-6 glow-card">
        <p className="text-sm text-gray-200">Available Balance</p>
        <h2 className="text-4xl font-bold mt-2">$1,250.00</h2>

        <div className="flex justify-between text-xs mt-2 opacity-80">
          <span>Processing Time</span>
          <span className="text-yellow-400">96 Hours</span>
        </div>
      </div>

      {/* FORM */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="card mt-6 space-y-4"
      >

        {/* AMOUNT */}
        <input
          type="number"
          placeholder="Enter Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input"
        />

        {/* WALLET */}
        <input
          type="text"
          placeholder="Enter Wallet Address (BEP20)"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          className="input"
        />

        {/* PASSWORD */}
        <input
          type="password"
          placeholder="Withdraw Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />

        {/* OTP */}
        <input
          type="text"
          placeholder="Email OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          className="input"
        />

        {/* CALCULATION */}
        {amount && (
          <div className="bg-black/30 p-3 rounded-xl border border-white/10 text-sm">

            <div className="flex justify-between text-gray-400">
              <span>Withdraw Amount</span>
              <span>${Number(amount).toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-red-400 mt-1">
              <span>Fee (5%)</span>
              <span>- ${fee.toFixed(2)}</span>
            </div>

            <div className="border-t border-white/10 mt-2 pt-2 flex justify-between font-semibold text-green-400">
              <span>You Receive</span>
              <span>${receive.toFixed(2)}</span>
            </div>

          </div>
        )}

        {/* BUTTON */}
        <button
          onClick={handleWithdraw}
          className="btn w-full"
        >
          Submit Withdrawal
        </button>

      </motion.div>

      {/* INFO CARD */}
      <div className="card mt-6 text-sm space-y-2">
        <p className="text-purple-400 font-semibold">📌 Withdrawal Rules</p>

        <p className="text-gray-400">• Processing time: 96 hours</p>
        <p className="text-gray-400">• Minimum withdrawal: 30 USDT</p>
        <p className="text-gray-400">• Monthly limit (VIP 1): 500 USDT</p>
        <p className="text-gray-400">• Monthly limit (VIP 2): 2000 USDT</p>
        <p className="text-gray-400">• Monthly limit (VIP 3): 5000 USDT</p>
      </div>

      {/* HISTORY */}
      <div className="mt-8">
        <h2 className="font-semibold mb-3 text-lg">Withdraw History</h2>

        <div className="space-y-2">

          <div className="card flex justify-between items-center">
            <div>
              <p>$300</p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
            <span className="text-yellow-400">Processing</span>
          </div>

          <div className="card flex justify-between items-center">
            <div>
              <p>$150</p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
            <span className="text-green-400">Done</span>
          </div>

        </div>
      </div>

    </div>
  );
}