"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import axios from "axios";
import GlassCard from "../components/GlassCard";
import GradientButton from "../components/GradientButton";
import StatCard from "../components/StatCard";

export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    axios
      .get(`${baseURL}/admin/stats`, {
        withCredentials: true,
        validateStatus: () => true,
      })
      .then((res) => setStats(res.status === 200 ? res.data?.stats || null : null))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  const statValue = (value: any) => {
    if (statsLoading) return "Loading";
    if (value === undefined || value === null) return "Login";
    return Number(value || 0).toLocaleString();
  };

  return (
    <div className="min-h-screen px-4 py-6 text-white relative overflow-hidden">
      <div className="absolute left-1/2 top-12 h-52 w-52 -translate-x-1/2 rounded-full bg-fuchsia-500/20 blur-[110px]" />

      <div className="max-w-[420px] mx-auto relative z-10">
        <div className="mb-8 flex items-center justify-between">
          <button onClick={() => router.push("/")} className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="HybridEarn logo"
              width={38}
              height={38}
              className="rounded-full shadow-[0_0_18px_rgba(139,92,246,0.75)]"
            />
            <div className="text-left">
              <p className="text-[10px] uppercase tracking-[0.28em] text-purple-300/70">Crypto Yield</p>
              <h1 className="text-lg font-black bg-gradient-to-r from-purple-200 via-fuchsia-300 to-cyan-200 bg-clip-text text-transparent">
                HybridEarn
              </h1>
            </div>
          </button>

          <button
            onClick={() => router.push("/login")}
            className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-purple-100 transition hover:border-purple-300/40 hover:bg-purple-500/15"
          >
            Login
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard glow="purple" className="mb-5">
            <p className="text-[10px] uppercase tracking-[0.35em] text-cyan-200/80">Ultra VIP Platform</p>
            <h2 className="mt-3 text-4xl font-black leading-tight text-glow">
              Earn Smart with <span className="bg-gradient-to-r from-purple-200 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">HybridEarn</span>
            </h2>
            <p className="mt-4 text-sm leading-6 text-gray-400">
              Daily ROI, referral income, staking plans, salary rewards and VIP progression in one premium crypto earning dashboard.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <GradientButton onClick={() => router.push("/signup")}>Start Earning</GradientButton>
              <button
                onClick={() => router.push("/login")}
                className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.1]"
              >
                Login
              </button>
            </div>
          </GlassCard>
        </motion.div>

        <div className="mb-5 grid grid-cols-3 gap-2">
          <StatCard title="Total Users" value={statValue(stats?.totalUsers)} tone="purple" className="p-3 text-center" />
          <StatCard title="Total Deposits" value={statValue(stats?.totalDeposits)} tone="cyan" className="p-3 text-center" />
          <StatCard title="Total Withdrawn" value={statValue(stats?.totalWithdrawals)} tone="green" className="p-3 text-center" />
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <Feature title="Daily ROI" desc="VIP rates from 1% to 2%" />
          <Feature title="Referral Income" desc="L1, L2 and L3 rewards" />
          <Feature title="Staking" desc="7d to 60d plans" />
          <Feature title="Salary Rewards" desc="Team milestone claims" />
        </div>

        <GlassCard glow="cyan" className="mb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-200/80">VIP Levels Preview</p>
              <h3 className="mt-1 text-lg font-black text-white">Scale your earning rate</h3>
            </div>
            <button onClick={() => router.push("/vip")} className="text-xs font-semibold text-cyan-200">
              View
            </button>
          </div>
          <div className="mt-4 space-y-3">
            <Plan name="VIP 1" roi="1%" condition="Starter active deposit" />
            <Plan name="VIP 2" roi="1.5%" condition="5 direct + 15 team" />
            <Plan name="VIP 3" roi="2%" condition="18 direct + 45 team" />
          </div>
        </GlassCard>

        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-center text-xs text-gray-400">
          Secure cookie auth, BEP20 wallet deposits, protected withdrawals and real account data only.
        </div>
      </div>
    </div>
  );
}

function Feature({ title, desc }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition hover:border-purple-300/40 hover:bg-purple-500/10">
      <p className="text-sm font-black text-white">{title}</p>
      <p className="mt-1 text-xs text-gray-400">{desc}</p>
    </div>
  );
}

function Plan({ name, roi, condition }: any) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-3">
      <div>
        <p className="text-sm font-bold text-white">{name}</p>
        <p className="text-[11px] text-gray-500">{condition}</p>
      </div>
      <span className="rounded-full border border-green-300/20 bg-green-400/10 px-3 py-1 text-xs font-black text-green-200">
        {roi}
      </span>
    </div>
  );
}