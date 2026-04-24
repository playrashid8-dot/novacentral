"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="space-y-5">

      {/* 🔥 BALANCE CARD */}
      <div className="glow-card">

        <p className="text-gray-300 text-sm">Total Balance</p>

        <h1 className="text-3xl font-bold mt-2">
          $1,250.00
        </h1>

        <div className="flex gap-3 mt-4">
          <button
            className="btn"
            onClick={() => router.push("/deposit")}
          >
            Deposit
          </button>

          <button className="btn-secondary">
            Withdraw
          </button>
        </div>

      </div>

      {/* ⚡ QUICK FEATURES */}
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
          <p className="sub">96h Delay</p>
        </div>

        <div className="card">
          <p className="title">🤝 Team</p>
          <p className="sub">Referral Income</p>
        </div>

      </div>

      {/* 📊 INVESTMENT PLANS */}
      <div className="space-y-3">

        <p className="title">Investment Plans</p>

        <div className="card flex justify-between items-center">
          <div>
            <p className="font-semibold">Starter Plan</p>
            <p className="sub">1% Daily</p>
          </div>
          <span>$50</span>
        </div>

        <div className="card flex justify-between items-center">
          <div>
            <p className="font-semibold">Pro Plan</p>
            <p className="sub">2% Daily</p>
          </div>
          <span>$200</span>
        </div>

        <div className="card flex justify-between items-center">
          <div>
            <p className="font-semibold">VIP Plan</p>
            <p className="sub">2.5% Daily</p>
          </div>
          <span>$500</span>
        </div>

      </div>

      {/* 🎁 BONUS SECTION */}
      <div className="card">
        <p className="title">🎁 Rewards & Bonus</p>
        <ul className="text-sm text-gray-400 mt-2 space-y-1">
          <li>✔ Referral Commission</li>
          <li>✔ Team Income Levels</li>
          <li>✔ VIP Salary Bonus</li>
        </ul>
      </div>

    </div>
  );
}