"use client";

import { useState } from "react";
import API from "../../lib/api";

export default function Deposit() {
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");

  const handleSubmit = async () => {
    try {
      await API.post("/deposit", {
        amount: Number(amount),
        txHash,
      });

      alert("Deposit submitted successfully");
      setAmount("");
      setTxHash("");
    } catch (err) {
      alert("Error submitting deposit");
    }
  };

  return (
    <div className="p-4 space-y-4">

      {/* WALLET ADDRESS */}
      <div className="bg-[#111827] p-4 rounded-xl">
        <p className="text-sm text-gray-400">Send USDT (BEP20)</p>
        <p className="font-bold break-all">
          0xYourWalletAddressHere
        </p>
      </div>

      {/* INPUTS */}
      <input
        className="input"
        placeholder="Enter Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <input
        className="input"
        placeholder="Enter TXID / Transaction Hash"
        value={txHash}
        onChange={(e) => setTxHash(e.target.value)}
      />

      {/* SUBMIT */}
      <button className="btn" onClick={handleSubmit}>
        Submit Deposit
      </button>

    </div>
  );
}