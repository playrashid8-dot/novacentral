"use client";

import { SkeletonLine } from "./Skeleton";

export default function WithdrawPageSkeleton() {
  return (
    <div className="relative w-full max-w-lg animate-pulse space-y-4 pb-4 text-white" aria-busy aria-label="Loading withdraw">
      <div className="flex justify-between gap-4">
        <div className="flex-1 space-y-2">
          <SkeletonLine className="h-3 w-24 bg-white/10" />
          <SkeletonLine className="h-9 w-40 max-w-full bg-white/10" />
        </div>
        <SkeletonLine className="h-12 w-20 shrink-0 rounded-2xl bg-white/10" />
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
        <SkeletonLine className="mb-4 h-3 w-36 bg-white/10" />
        <SkeletonLine className="mb-3 h-12 w-full max-w-[220px] rounded-xl bg-white/10" />
        <SkeletonLine className="h-4 w-full bg-white/10" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SkeletonLine className="h-24 rounded-2xl bg-white/10" />
        <SkeletonLine className="h-24 rounded-2xl bg-white/10" />
      </div>

      <div className="rounded-2xl border border-white/[0.06] p-5">
        <SkeletonLine className="mb-6 h-6 w-44 bg-white/10" />
        <div className="space-y-4">
          <SkeletonLine className="h-12 w-full rounded-xl bg-white/10" />
          <SkeletonLine className="h-12 w-full rounded-xl bg-white/10" />
          <SkeletonLine className="h-12 w-full rounded-xl bg-white/10" />
        </div>
        <SkeletonLine className="mt-6 h-14 w-full rounded-2xl bg-white/10" />
      </div>

      <div className="space-y-3">
        <SkeletonLine className="h-4 w-36 bg-white/10" />
        <SkeletonLine className="h-24 rounded-2xl bg-white/10" />
        <SkeletonLine className="h-24 rounded-2xl bg-white/10" />
      </div>
    </div>
  );
}
