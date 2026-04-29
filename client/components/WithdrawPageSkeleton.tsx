"use client";

import { SkeletonLine } from "./Skeleton";

/** Card-aligned skeleton if a full-page withdraw placeholder is needed. Prefer inline skeletons on /withdraw. */
export default function WithdrawPageSkeleton() {
  return (
    <div className="relative w-full max-w-lg animate-pulse space-y-4 px-4 pb-8 text-white" aria-busy aria-label="Loading withdraw">
      <div className={`rounded-2xl border border-white/[0.08] bg-white/5 p-5 shadow-soft backdrop-blur-xl`}>
        <SkeletonLine className="h-3 w-24 bg-white/10" />
        <SkeletonLine className="mt-4 h-10 w-40 bg-white/10" />
        <SkeletonLine className="mt-4 h-12 w-full rounded-xl bg-white/10" />
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/5 p-5 shadow-soft backdrop-blur-xl">
        <div className="space-y-4">
          <SkeletonLine className="h-12 w-full rounded-xl bg-white/10" />
          <SkeletonLine className="h-20 w-full rounded-2xl bg-white/10" />
          <SkeletonLine className="h-12 w-full rounded-xl bg-white/10" />
          <SkeletonLine className="h-12 w-full rounded-xl bg-white/10" />
        </div>
        <SkeletonLine className="mt-6 h-12 w-full rounded-xl bg-white/10" />
      </div>

      <div className="space-y-3">
        <SkeletonLine className="h-4 w-36 bg-white/10" />
        <SkeletonLine className="h-28 rounded-2xl bg-white/10" />
        <SkeletonLine className="h-28 rounded-2xl bg-white/10" />
      </div>
    </div>
  );
}
