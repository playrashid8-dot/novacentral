"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import axios from "axios";
import GlassCard from "../components/GlassCard";
import StatCard from "../components/StatCard";

type PlatformStats = {
  totalUsers?: number;
  totalDeposits?: number;
  totalWithdrawals?: number;
};

export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    axios
      .get(`${baseURL}/public/platform-stats`, {
        withCredentials: true,
        validateStatus: (s) => s === 200,
      })
      .then((res) => {
        const payload = res.data?.stats ?? res.data?.data?.stats;
        if (payload && typeof payload === "object") {
          setStats(payload as PlatformStats);
          setStatsError(false);
        } else {
          setStats(null);
          setStatsError(true);
        }
      })
      .catch(() => {
        setStats(null);
        setStatsError(true);
      })
      .finally(() => setStatsLoading(false));
  }, []);

  const statDisplay = (value: unknown) => {
    if (statsLoading) return "…";
    if (statsError || value === undefined || value === null) return "—";
    return Number(value).toLocaleString();
  };

  return (
    <div className="min-h-screen px-4 py-8 pb-16 text-white relative overflow-hidden sm:py-10">
      <div className="absolute left-1/2 top-12 h-52 w-52 -translate-x-1/2 rounded-full bg-fuchsia-500/20 blur-[110px]" />
      <div className="absolute right-[12%] top-[40%] h-40 w-40 rounded-full bg-cyan-500/10 blur-[90px]" />

      <div className="max-w-2xl mx-auto relative z-10">
        {/* Header */}
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <button type="button" onClick={() => router.push("/")} className="flex items-center gap-3 text-left">
            <Image
              src="/logo.png"
              alt="HybridEarn"
              width={40}
              height={40}
              className="rounded-full shadow-[0_0_18px_rgba(139,92,246,0.45)]"
            />
            <span className="text-lg font-black bg-gradient-to-r from-purple-200 via-fuchsia-300 to-cyan-200 bg-clip-text text-transparent">
              HybridEarn
            </span>
          </button>
          <nav className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-purple-100 transition hover:border-purple-300/40 hover:bg-purple-500/15"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => router.push("/signup")}
              className="rounded-full border border-cyan-400/35 bg-cyan-500/12 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
            >
              Create Account
            </button>
          </nav>
        </header>

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <GlassCard glow="purple" className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">HybridEarn</h1>
            <p className="mt-3 text-lg sm:text-xl font-semibold text-gray-200">Earn on-chain with HybridEarn</p>
            <p className="mt-4 text-sm leading-relaxed text-gray-400">
              Manual daily ROI, staking, referrals, and team salary bonuses — with secure cookie auth and BEP20
              infrastructure.
            </p>
          </GlassCard>
        </motion.div>

        {/* Live stats */}
        <section className="mb-8" aria-labelledby="live-stats-heading">
          <h2 id="live-stats-heading" className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-purple-300/80">
            Live platform stats
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard title="Total Users" value={statDisplay(stats?.totalUsers)} tone="purple" className="p-4 text-center" />
            <StatCard title="Total Deposits" value={statDisplay(stats?.totalDeposits)} tone="cyan" className="p-4 text-center" />
            <StatCard
              title="Total Withdrawn"
              value={statDisplay(stats?.totalWithdrawals)}
              tone="green"
              className="p-4 text-center"
            />
          </div>
          {statsError && !statsLoading && (
            <p className="mt-2 text-center text-[11px] text-gray-500">Stats could not be loaded. Please try again later.</p>
          )}
        </section>

        {/* Features */}
        <section className="mb-8" aria-labelledby="features-heading">
          <h2 id="features-heading" className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-200/75">
            Features
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Feature title="Daily ROI" desc="Manual daily ROI system" icon="calendar" />
            <Feature title="VIP Rates" desc="VIP rates from 1% to 2%" icon="spark" />
            <Feature title="Referral Income" desc="L1, L2, L3 rewards" icon="users" />
            <Feature title="Staking" desc="7d to 60d plans" icon="layers" />
            <Feature title="Salary Rewards" desc="Team milestone claims" icon="award" className="sm:col-span-2" />
          </div>
        </section>

        {/* How it works */}
        <GlassCard glow="indigo" className="mb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-indigo-200/80">How it works</p>
          <ol className="mt-4 space-y-4 text-sm leading-relaxed text-gray-300 list-none">
            <Step index={1} text="Create an account and fund via BEP20 flows shown in the dashboard." />
            <Step index={2} text="Claim daily ROI on deposit + active stakes; optionally lock plans for staking yield." />
            <Step index={3} text="Invite your team, unlock salary stages, withdraw to a wallet you specify (96h protections)." />
          </ol>
        </GlassCard>

        {/* Security */}
        <section className="mb-8" aria-labelledby="security-heading">
          <h2 id="security-heading" className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-200/75">
            Security
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SecurityCard label="httpOnly cookies" icon="cookie" />
            <SecurityCard label="Withdrawal review" icon="shield" />
            <SecurityCard label="BEP20 USDT rails" icon="chain" />
          </div>
        </section>

        {/* VIP levels */}
        <GlassCard glow="cyan" className="mb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-200/80">VIP levels</p>
          <h3 className="mt-2 text-xl font-black text-white">Scale your earning rate</h3>
          <div className="mt-5 space-y-3">
            <Plan name="VIP 1" roi="1%" condition="Starter active deposit" />
            <Plan name="VIP 2" roi="1.5%" condition="5 direct + 15 team" />
            <Plan name="VIP 3" roi="2%" condition="18 direct + 45 team" />
          </div>
        </GlassCard>

        {/* Footer */}
        <footer className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center space-y-3">
          <p className="text-xs leading-relaxed text-gray-400">
            Secure cookie auth, BEP20 wallet deposits, protected withdrawals and real account data only.
          </p>
          <p className="text-[11px] leading-relaxed text-gray-500">
            VIP levels unlock higher ROI based on direct referrals and team growth.
          </p>
        </footer>
      </div>
    </div>
  );
}

function Step({ index, text }: { index: number; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/25 text-xs font-black text-indigo-100">
        {index}
      </span>
      <span className="pt-1">{text}</span>
    </li>
  );
}

function Feature({
  title,
  desc,
  icon,
  className = "",
}: {
  title: string;
  desc: string;
  icon: "calendar" | "spark" | "users" | "layers" | "award";
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition hover:border-purple-300/35 hover:bg-purple-500/[0.08] ${className}`}
    >
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-200">
          <FeatureIcon name={icon} />
        </span>
        <div>
          <p className="text-sm font-bold text-white">
            <span className="mr-1.5 text-emerald-400" aria-hidden>
              ✔
            </span>
            {title}
          </p>
          <p className="mt-1 text-xs text-gray-400 leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  );
}

function FeatureIcon({ name }: { name: "calendar" | "spark" | "users" | "layers" | "award" }) {
  const common = "h-5 w-5";
  switch (name) {
    case "calendar":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "spark":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 3l1.2 4.4L18 9l-4.8 1.6L12 15l-1.2-4.4L6 9l4.8-1.6L12 3z" />
          <path d="M19 14l.6 2.1L21.5 17l-2 .9L19 20l-1.5-2.1L15.5 17l2-.9L19 14z" />
        </svg>
      );
    case "users":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "layers":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      );
    case "award":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="8" r="6" />
          <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" />
        </svg>
      );
    default:
      return null;
  }
}

function SecurityCard({ label, icon }: { label: string; icon: "lock" | "shield" | "chain" }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-200/90">
        <SecurityIcon name={icon} />
      </span>
      <span className="text-sm font-semibold text-gray-200">{label}</span>
    </div>
  );
}

function SecurityIcon({ name }: { name: "lock" | "shield" | "chain" }) {
  const common = "h-5 w-5";
  if (name === "shield") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }
  if (name === "chain") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1" />
      </svg>
    );
  }
  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function Plan({ name, roi, condition }: { name: string; roi: string; condition: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="min-w-0">
        <p className="text-sm font-bold text-white">{name}</p>
        <p className="mt-0.5 text-[11px] text-gray-500 leading-snug">{condition}</p>
      </div>
      <span className="shrink-0 rounded-full border border-green-300/25 bg-green-400/10 px-3 py-1.5 text-xs font-black text-green-200">
        {roi}
      </span>
    </div>
  );
}
