"use client";

import Image from "next/image";
import Link from "next/link";

export default function AppNavbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#0B0F19]/85 backdrop-blur-xl supports-[backdrop-filter]:bg-[#0B0F19]/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2.5 transition hover:opacity-90">
          <Image
            src="/logo.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)]"
          />
          <div className="text-left leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400/80">
              NovaCentral
            </p>
            <p className="text-sm font-bold text-white">HybridEarn</p>
          </div>
        </Link>
        <Link
          href="/profile"
          className="rounded-2xl border border-white/10 bg-[#111827] px-4 py-2 text-xs font-semibold text-gray-200 shadow-md transition hover:border-emerald-500/40 hover:shadow-[0_4px_24px_rgba(16,185,129,0.15)] hover:scale-[1.02]"
        >
          Account
        </Link>
      </div>
    </header>
  );
}
