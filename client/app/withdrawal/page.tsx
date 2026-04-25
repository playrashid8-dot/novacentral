"use client";

import { useState } from "react";
import API from "../../lib/api";

export default function Withdrawal() {
  const [amount, setAmount] = useState("");

  const withdraw = async () => {
    try {
      await API.post("/withdraw", { amount });
      alert("Withdrawal requested ✅");
    } catch {
      alert("Failed ❌");
    }
  };

  return (
    <div className="min-h-screen text-white p-5">
      <h1 className="text-xl font-bold mb-4">Withdraw</h1>

      <input
        className="input mb-3"
        placeholder="Amount"
        onChange={(e) => setAmount(e.target.value)}
      />

      <button onClick={withdraw} className="btn w-full">
        Withdraw
      </button>
    </div>
  );
}