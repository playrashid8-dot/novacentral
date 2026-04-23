"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");

    // ❗ Agar token nahi hai → login pe bhejo
    if (!token) {
      router.push("/login");
      return;
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
      headers: {
        Authorization: token,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Unauthorized");
        }
        const data = await res.json();
        setUser(data);
      })
      .catch((err) => {
        console.log(err);

        // ❗ token invalid → logout
        localStorage.removeItem("token");
        router.push("/login");
      });
  }, [router]);

  if (!user)
    return (
      <div className="flex justify-center items-center h-screen text-white bg-black">
        Loading...
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-blue-900 to-black text-white p-5">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-green-400">🚀 NovaCentral</h1>

        <div className="text-right">
          <p className="text-sm text-gray-300">Welcome</p>
          <p className="font-bold">{user.username}</p>
        </div>
      </div>

      {/* BALANCE CARD */}
      <div className="bg-white/10 backdrop-blur-lg p-6 rounded-xl shadow-lg mb-6 border border-green-500/20">
        <p className="text-gray-300">Total Balance</p>
        <h2 className="text-3xl font-bold mt-2 text-green-400">
          {user.balance || 0} USDT
        </h2>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white/10 p-4 rounded-xl border border-white/10">
          <p className="text-gray-400 text-sm">Referral Code</p>
          <h3 className="text-xl font-bold text-blue-400">
            {user.referralCode || "N/A"}
          </h3>
        </div>

        <div className="bg-white/10 p-4 rounded-xl border border-white/10">
          <p className="text-gray-400 text-sm">Status</p>
          <h3 className="text-xl font-bold text-green-400">
            Active
          </h3>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <button className="bg-green-500 hover:bg-green-600 p-4 rounded-xl font-bold transition">
          Deposit
        </button>

        <button className="bg-red-500 hover:bg-red-600 p-4 rounded-xl font-bold transition">
          Withdraw
        </button>
      </div>

      {/* LOGOUT */}
      <button
        onClick={() => {
          localStorage.removeItem("token");
          router.push("/login");
        }}
        className="w-full bg-gray-800 hover:bg-gray-700 p-3 rounded-xl text-sm"
      >
        Logout
      </button>
    </div>
  );
}