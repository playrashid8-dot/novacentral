"use client";

import { useEffect, useState } from "react";
import API from "../../lib/api";
import { useRouter } from "next/navigation";

type UserType = {
  email: string;
  balance: number;
  totalDeposit: number;
  totalWithdraw: number;
};

export default function Dashboard() {
  const [user, setUser] = useState<UserType | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await API.get("/user/me");
        setUser(res.data);
      } catch {
        console.log("Error");
      }
    };

    fetchUser();
  }, []);

  if (!user) return <p>Loading...</p>;

  return (
    <div className="space-y-4 fade-in">

      {/* BALANCE */}
      <div className="balance-card">
        <p>Total Balance</p>
        <h1 className="text-3xl font-bold">
          ${user.balance.toFixed(2)}
        </h1>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 gap-3">

        <div className="stat-card">
          <p>Deposit</p>
          <h2>${user.totalDeposit || 0}</h2>
        </div>

        <div className="stat-card">
          <p>Withdraw</p>
          <h2>${user.totalWithdraw || 0}</h2>
        </div>

      </div>

      {/* ACTIONS */}
      <div className="grid grid-cols-2 gap-3">

        <button
          onClick={() => router.push("/deposit")}
          className="btn"
        >
          Deposit
        </button>

        <button className="btn-secondary">
          Withdraw
        </button>

      </div>

      {/* USER INFO */}
      <div className="card">
        <p className="subtext">Email</p>
        <p>{user.email}</p>
      </div>

    </div>
  );
}