"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import API from "../../lib/api";

type UserType = {
  email: string;
  balance: number;
  totalDeposit: number;
  totalWithdraw: number;
};

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await API.get("/user/me");
        setUser(res.data);
      } catch (err) {
        console.log("Error fetching user");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  // LOADING
  if (loading) {
    return <p className="p-4 text-center">Loading...</p>;
  }

  // NO USER
  if (!user) {
    return <p className="p-4 text-center">No data found</p>;
  }

  return (
    <div className="p-4 space-y-4">

      {/* 🔥 BALANCE CARD */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-5 rounded-2xl shadow-lg">
        <p className="text-sm opacity-80">Total Balance</p>
        <h1 className="text-3xl font-bold mt-2">
          ${user.balance.toFixed(2)}
        </h1>
      </div>

      {/* 📊 STATS */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#111827] p-4 rounded-xl">
          <p className="text-sm text-gray-400">Deposit</p>
          <h2 className="text-lg font-semibold">
            ${user.totalDeposit || 0}
          </h2>
        </div>

        <div className="bg-[#111827] p-4 rounded-xl">
          <p className="text-sm text-gray-400">Withdraw</p>
          <h2 className="text-lg font-semibold">
            ${user.totalWithdraw || 0}
          </h2>
        </div>
      </div>

      {/* ⚡ ACTION BUTTONS */}
      <div className="grid grid-cols-2 gap-3">

        {/* ✅ DEPOSIT BUTTON */}
        <button
          onClick={() => router.push("/deposit")}
          className="bg-green-500 p-3 rounded-xl font-semibold"
        >
          Deposit
        </button>

        {/* ❌ Withdraw (next step) */}
        <button
          onClick={() => alert("Withdraw coming next")}
          className="bg-red-500 p-3 rounded-xl font-semibold"
        >
          Withdraw
        </button>

      </div>

      {/* 👤 USER INFO */}
      <div className="bg-[#111827] p-4 rounded-xl">
        <p className="text-sm text-gray-400">Email</p>
        <p className="font-medium">{user.email}</p>
      </div>

    </div>
  );
}