"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { fetchHybridSummary } from "../lib/hybrid";

/** Deposit excluded — balance strip adds clutter on the deposit screen itself. */
const ROUTES = new Set(["/withdraw", "/history", "/staking", "/investment"]);

function MobileStickyBalanceInner() {
  const pathname = usePathname();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const h = await fetchHybridSummary().catch(() => null);
      const dep = Number(h?.depositBalance ?? 0);
      const rew = Number(h?.rewardBalance ?? 0);
      const stake = Number(h?.activeStakeAmount ?? 0);
      setBalance(dep + rew + stake);
    } catch {
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!pathname || !ROUTES.has(pathname)) return;
    setLoading(true);
    void load();
    const id = window.setInterval(() => void load(), 45000);
    return () => clearInterval(id);
  }, [pathname, load]);

  if (!pathname || !ROUTES.has(pathname)) return null;

  return (
    <div className="lg:hidden">
      <div className="h-[3.25rem] w-full shrink-0" aria-hidden />
      <div className="pointer-events-none fixed left-0 right-0 top-14 z-40 px-4 pt-2">
        <div className="pointer-events-auto mx-auto flex max-w-lg items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#0B0F19]/92 px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-400/80">
              Total balance
            </p>
            <p className="truncate font-mono text-lg font-black tabular-nums text-white">
              {loading ? <span className="inline-block h-6 w-28 animate-pulse rounded-lg bg-white/10 align-middle" /> : `$${(balance ?? 0).toFixed(2)}`}
            </p>
          </div>
          <Link
            href="/deposit"
            className="shrink-0 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-[11px] font-bold text-emerald-100 transition hover:bg-emerald-500/25 active:scale-[0.98]"
          >
            Add funds
          </Link>
        </div>
      </div>
    </div>
  );
}

export default memo(MobileStickyBalanceInner);
