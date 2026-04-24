"use client";

import { useEffect, useState } from "react";
import API from "../../lib/api";

export default function Wallet() {

  const [user, setUser]: any = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const res = await API.get("/user/me");
      setUser(res.data.user || res.data);
    } catch (err) {}
  };

  return (
    <div className="min-h-screen px-4 py-6 text-white">

      <h1 className="text-xl font-bold mb-5">💰 Wallet</h1>

      <div className="glow-card mb-5">
        <p>Balance</p>
        <h2 className="text-3xl font-bold mt-1">
          ${user?.balance || 0}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-4">

        <div className="card">
          <p>Total Deposit</p>
          <h3>${user?.totalDeposit || 0}</h3>
        </div>

        <div className="card">
          <p>Total Withdraw</p>
          <h3>${user?.totalWithdraw || 0}</h3>
        </div>

      </div>

    </div>
  );
}