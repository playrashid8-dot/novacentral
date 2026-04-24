"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="space-y-6 fade-in">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">🚀 NovaCentral</h1>

        <div className="flex gap-2">
          <button
            onClick={() => router.push("/login")}
            className="btn-secondary px-3 py-1"
          >
            Login
          </button>

          <button
            onClick={() => router.push("/signup")}
            className="btn px-3 py-1"
          >
            Signup
          </button>
        </div>
      </div>

      {/* HERO */}
      <div className="balance-card">
        <h2 className="text-2xl font-bold mb-2">
          Hybrid Crypto Earning Platform
        </h2>

        <p className="text-sm opacity-90">
          Earn daily profits with staking, referrals, and smart investment plans.
        </p>

        <button
          onClick={() => router.push("/signup")}
          className="mt-4 bg-black px-5 py-2 rounded-xl font-semibold"
        >
          Start Earning
        </button>
      </div>

      {/* FEATURES */}
      <div className="grid grid-cols-2 gap-3">

        <div className="card">
          <p>📈 Daily ROI</p>
          <p className="subtext">1% - 2.5%</p>
        </div>

        <div className="card">
          <p>💰 Deposit</p>
          <p className="subtext">Instant update</p>
        </div>

        <div className="card">
          <p>💸 Withdraw</p>
          <p className="subtext">96h secure</p>
        </div>

        <div className="card">
          <p>🤝 Referral</p>
          <p className="subtext">Team income</p>
        </div>

      </div>

      {/* PLANS */}
      <div>
        <h2 className="title">🔥 Investment Plans</h2>

        <div className="space-y-3">

          <div className="card flex justify-between">
            <div>
              <p>Starter</p>
              <p className="subtext">1% Daily</p>
            </div>
            <p>$50</p>
          </div>

          <div className="card flex justify-between">
            <div>
              <p>Pro</p>
              <p className="subtext">2% Daily</p>
            </div>
            <p>$200</p>
          </div>

          <div className="card flex justify-between">
            <div>
              <p>VIP</p>
              <p className="subtext">2.5% Daily</p>
            </div>
            <p>$500</p>
          </div>

        </div>
      </div>

      {/* BONUS */}
      <div>
        <h2 className="title">🎁 Rewards & Bonus</h2>

        <div className="reward-box">
          <p>✔ Referral Commission</p>
          <p>✔ Team Income Levels</p>
          <p>✔ VIP Salary Rewards</p>
          <p>✔ Passive Daily Earnings</p>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => router.push("/signup")}
        className="btn"
      >
        Join Now 🚀
      </button>

    </div>
  );
}