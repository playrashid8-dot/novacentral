"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="space-y-5">

      {/* BALANCE */}
      <div className="glow-card">
        <p className="text-gray-300 text-sm">Total Balance</p>
        <h1 className="text-3xl font-bold mt-2">$1,250.00</h1>

        <div className="flex gap-3 mt-4">
          <button className="btn" onClick={() => router.push("/deposit")}>
            Deposit
          </button>
          <button className="btn-secondary">
            Withdraw
          </button>
        </div>
      </div>

      {/* FEATURES */}
      <div className="grid grid-cols-2 gap-3">

        <div className="card">
          <p className="title">📈 ROI</p>
          <p className="sub">Daily Profit</p>
        </div>

        <div className="card">
          <p className="title">💰 Deposit</p>
          <p className="sub">Instant</p>
        </div>

        <div className="card">
          <p className="title">🏦 Withdraw</p>
          <p className="sub">96h delay</p>
        </div>

        <div className="card">
          <p className="title">🤝 Team</p>
          <p className="sub">Referral</p>
        </div>

      </div>

      {/* PLANS */}
      <div className="space-y-3">
        <p className="title">Investment Plans</p>

        <div className="card flex justify-between">
          <div>
            <p>Starter</p>
            <p className="sub">1% daily</p>
          </div>
          <p>$50</p>
        </div>

        <div className="card flex justify-between">
          <div>
            <p>Pro</p>
            <p className="sub">2% daily</p>
          </div>
          <p>$200</p>
        </div>

        <div className="card flex justify-between">
          <div>
            <p>VIP</p>
            <p className="sub">2.5% daily</p>
          </div>
          <p>$500</p>
        </div>
      </div>

    </div>
  );
}