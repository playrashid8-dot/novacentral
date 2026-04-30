"use client";

import { useEffect, useState } from "react";
import GlassCard from "../GlassCard";

const STORAGE_KEY = "hideRewardBanner";

export default function RewardNotification() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) {
        setIsVisible(false);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore storage errors
    }
  };

  if (!isVisible) return null;

  return (
    <div className="mt-4 w-full max-w-full sm:mt-5">
      <GlassCard glow="purple" className="shadow-[0_0_36px_rgba(88,28,135,0.22)]">
        <div className="relative pr-10 sm:pr-12">
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white active:scale-[0.97]"
            aria-label="Dismiss reward information"
          >
            <span className="text-lg leading-none">×</span>
          </button>

          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold tracking-tight text-white sm:text-lg">
                <span className="mr-1.5" aria-hidden>
                  🔔
                </span>
                Reward System
              </h2>
              <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400 sm:text-xs">
              Fast & Secure Trusted Platform
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 sm:p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-200/90 sm:text-xs">
                Direct Joining
              </p>
              <ul className="space-y-1.5 text-xs text-gray-200 sm:text-sm">
                <li className="flex flex-wrap items-baseline gap-x-1">
                  <span className="tabular-nums text-white/95">100 USDT</span>
                  <span className="text-gray-500">→</span>
                  <span>
                    Reward <span className="tabular-nums">10 USDT</span>
                  </span>
                </li>
                <li className="flex flex-wrap items-baseline gap-x-1">
                  <span className="tabular-nums text-white/95">200 USDT</span>
                  <span className="text-gray-500">→</span>
                  <span>
                    Reward <span className="tabular-nums">20 USDT</span>
                  </span>
                </li>
              </ul>

              <p className="border-t border-white/[0.06] pt-3 text-xs text-gray-200 sm:text-sm">
                <span className="mr-1" aria-hidden>
                  🎁
                </span>
                Level 1 Bonus: <span className="font-semibold tabular-nums text-emerald-200/95">5 USDT</span>
              </p>

              <div className="border-t border-white/[0.06] pt-3">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-200/90 sm:text-xs">
                  <span aria-hidden>💼</span>
                  Salary System
                </p>
                <ul className="space-y-2 text-[11px] leading-snug text-gray-300 sm:text-xs sm:leading-relaxed">
                  <li>
                    <span className="font-medium text-white/90">Stage 1:</span> 5 Direct + 15 Team →{" "}
                    <span className="tabular-nums text-emerald-200/90">30 USDT</span>
                  </li>
                  <li>
                    <span className="font-medium text-white/90">Stage 2:</span> 10 Direct + 35 Team →{" "}
                    <span className="tabular-nums text-emerald-200/90">80 USDT</span>
                  </li>
                  <li>
                    <span className="font-medium text-white/90">Stage 3:</span> 25 Direct + 100 Team →{" "}
                    <span className="tabular-nums text-emerald-200/90">250 USDT</span>
                  </li>
                  <li>
                    <span className="font-medium text-white/90">Stage 4:</span> 45 Direct + 150 Team →{" "}
                    <span className="tabular-nums text-emerald-200/90">500 USDT</span>
                  </li>
                </ul>
              </div>

              <p className="border-t border-white/[0.06] pt-3 text-[11px] text-amber-200/85 sm:text-xs">
                Minimum deposit: <span className="font-semibold tabular-nums">50 USDT</span>
              </p>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
