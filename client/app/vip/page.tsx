"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchHybridSummary } from "../../lib/hybrid";
import ProtectedRoute from "../../components/ProtectedRoute";
import EmptyState from "../../components/EmptyState";
import Loader from "../../components/Loader";

type LevelRule = {
  level: number;
  minDeposit: number;
  directCount: number;
  teamCount: number;
  bonus: number;
};

export default function VIP() {
  const router = useRouter();
  const [hybrid, setHybrid]: any = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHybridSummary()
      .then((hybridData) => {
        if (hybridData) setHybrid(hybridData);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <ProtectedRoute>
        <Loader />
      </ProtectedRoute>
    );
  }

  const levelRules: LevelRule[] = Array.isArray(hybrid?.levelRules) ? hybrid.levelRules : [];
  const currentLevel = Number(hybrid?.level ?? 0);

  const roiLabel = (level: number) =>
    level === 1 ? "1%" : level === 2 ? "1.5%" : level === 3 ? "2%" : "—";

  const vipLevels = levelRules.map((rule) => ({
    name: `VIP ${rule.level}`,
    level: rule.level,
    requirement: `Deposit ≥ ${rule.minDeposit} · ${rule.directCount} direct / ${rule.teamCount} team`,
    roi: roiLabel(rule.level),
    benefits: [
      `Level ${rule.level} daily ROI`,
      "HybridEarn access",
      rule.bonus ? `Level bonus $${rule.bonus}` : "Team milestones",
    ],
    color:
      rule.level === 1
        ? "from-purple-500 to-indigo-500"
        : rule.level === 2
          ? "from-blue-500 to-cyan-500"
          : "from-fuchsia-500 via-purple-500 to-blue-500",
    recommended: rule.level === 3,
  }));

  return (
    <ProtectedRoute>
    <div className="min-h-screen max-w-[420px] mx-auto px-4 py-6 text-white relative overflow-hidden bg-[#040406]">

      {/* 🌌 BACKGROUND */}
      <div className="absolute w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[150px] top-[-150px] left-[-150px]" />
      <div className="absolute w-[500px] h-[500px] bg-indigo-600 opacity-20 blur-[150px] bottom-[-150px] right-[-150px]" />

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 relative z-10">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-purple-300/70">Premium Access</p>
          <h1 className="text-2xl font-black bg-gradient-to-r from-purple-300 via-fuchsia-300 to-blue-300 bg-clip-text text-transparent">
            HybridEarn VIP
          </h1>
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-purple-300 bg-white/[0.06] border border-white/10 rounded-full px-4 py-2 hover:bg-purple-500/15 transition-all duration-300"
        >
          Back
        </button>
      </div>

      {/* CURRENT STATUS */}
      <div className="bg-gradient-to-br from-purple-500/20 via-indigo-500/10 to-blue-500/10 p-5 rounded-3xl border border-purple-300/30 text-center mb-6 backdrop-blur-2xl shadow-[0_0_50px_rgba(124,58,237,0.32)]">
        <p className="text-xs text-gray-400 uppercase tracking-[0.22em]">Your VIP Level</p>
        <h2 className="text-3xl font-black text-white mt-2 text-glow">
          {currentLevel > 0 ? `VIP ${currentLevel}` : "Not ranked"}
        </h2>

        <p className="text-xs text-gray-500 mt-1">
          Deposit Balance: ${Number(hybrid?.depositBalance || 0).toFixed(2)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <VIPMetric
          label="Hybrid Level"
          value={currentLevel > 0 ? `VIP ${currentLevel}` : "—"}
        />
        <VIPMetric
          label="Hybrid ROI"
          value={`${(Number(hybrid?.roiRate || 0) * 100).toFixed(2)}%`}
        />
        <VIPMetric label="Direct Team" value={hybrid?.directCount || 0} />
        <VIPMetric label="Total Team" value={hybrid?.teamCount || 0} />
      </div>

      {/* VIP CARDS */}
      <div className="space-y-4 relative z-10">
        {!hybrid?.levelRules?.length ? (
          <EmptyState text="No VIP ladder data yet. Open HybridEarn after your summary loads." />
        ) : (
          <>
            {vipLevels.map((vip, i) => {
              const unlocked = currentLevel >= vip.level;
              const current = currentLevel === vip.level;

              return (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.03 }}
                  className={`p-[1px] rounded-3xl bg-gradient-to-r ${vip.color} ${
                    current || vip.recommended ? "vip-pulse shadow-[0_0_60px_rgba(168,85,247,0.45)]" : ""
                  }`}
                >
                  <div className="bg-[#08080d]/95 p-5 rounded-3xl backdrop-blur-2xl relative overflow-hidden">
                    {current && (
                      <span className="absolute right-4 top-4 rounded-full bg-purple-500/20 border border-purple-300/40 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-purple-100">
                        Current Level
                      </span>
                    )}

                    <div className="flex justify-between items-center">
                      <h2 className="font-black text-xl bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">{vip.name}</h2>

                      {unlocked ? (
                        <span className="text-xs text-green-300 rounded-full bg-green-400/10 border border-green-400/20 px-3 py-1">Unlocked</span>
                      ) : (
                        <span className="text-xs text-gray-400 rounded-full bg-white/5 border border-white/10 px-3 py-1">Locked</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-5">
                      <VIPMetric label="ROI" value={vip.roi} />
                      <VIPMetric label="Requirement" value={vip.requirement} />
                    </div>

                    <p className="text-xs text-gray-400 mt-4">
                      Requirement: <span className="font-bold text-white">{vip.requirement}</span>
                    </p>

                    <ul className="mt-4 space-y-2">
                      {vip.benefits.map((benefit) => (
                        <li key={benefit} className="flex items-center gap-2 text-xs text-gray-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.8)]" />
                          {benefit}
                        </li>
                      ))}
                    </ul>

                    {!unlocked && (
                      <button
                        onClick={() => router.push("/deposit")}
                        className="mt-5 w-full bg-gradient-to-r from-[#7c3aed] via-[#a855f7] to-[#4f46e5] p-3 rounded-xl text-sm font-bold shadow-[0_0_30px_rgba(124,58,237,0.5)] hover:scale-105 hover:shadow-[0_0_42px_rgba(168,85,247,0.72)] transition-all duration-300"
                      >
                        Go to Deposit
                      </button>
                    )}

                  </div>
                </motion.div>
              );
            })}
          </>
        )}
      </div>

      {/* INFO */}
      <div className="mt-6 bg-white/[0.06] p-4 rounded-2xl border border-white/10 text-sm backdrop-blur-2xl">

        <p className="text-yellow-400 font-semibold mb-2">
          VIP Benefits
        </p>

        <ul className="space-y-1 text-gray-400 text-xs">
          <li>Higher ROI on investments</li>
          <li>Extra deposit bonuses</li>
          <li>Faster withdrawals</li>
          <li>Exclusive rewards and promotions</li>
        </ul>

      </div>

    </div>
    </ProtectedRoute>
  );
}

function VIPMetric({ label, value }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-black text-purple-100">{value}</p>
    </div>
  );
}
