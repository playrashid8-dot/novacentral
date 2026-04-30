"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getApiErrorMessage } from "../../lib/api";
import { claimHybridRoi } from "../../lib/hybrid";
import {
  fetchDashboardMainBundleSWR,
  DASHBOARD_MAIN_BUNDLE_KEY,
  hybridDashboardSWRConfig,
} from "../../lib/swr-fetch";
import { showToast } from "../../lib/vipToast";
import ProtectedRoute from "../../components/ProtectedRoute";
import PageWrapper from "../../components/PageWrapper";
import LiveRefreshIndicator from "../../components/LiveRefreshIndicator";

const CARD = "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl";

const DashboardRoiSection = dynamic(
  () => import("../../components/dashboard/DashboardRoiSection"),
  {
    loading: () => <RoiBlockSkeleton cardClass={CARD} />,
    ssr: false,
  },
);

function StatTilesSkeleton({ cardClassName }: { cardClassName: string }) {
  return (
    <div className="mt-5 grid grid-cols-1 gap-2.5 sm:mt-6 sm:grid-cols-2 sm:gap-3" aria-busy aria-label="Loading stats">
      {[1, 2].map((i) => (
        <div key={i} className={`${cardClassName} p-3 sm:p-4`}>
          <div className="h-2.5 w-24 animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-8 w-28 animate-pulse rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

function RoiBlockSkeleton({ cardClass }: { cardClass: string }) {
  return (
    <div className={`${cardClass} mt-5 animate-pulse p-4 shadow-none sm:p-5`} aria-busy aria-label="Loading ROI">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-5 w-32 rounded bg-white/15" />
        <div className="h-12 w-full rounded-2xl bg-white/10 sm:w-36" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();

  const [roiLoading, setRoiLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const {
    data: bundle,
    mutate: mutateDashboardBundle,
    isLoading: loadingBundle,
  } = useSWR(DASHBOARD_MAIN_BUNDLE_KEY, fetchDashboardMainBundleSWR, hybridDashboardSWRConfig);

  const user = bundle?.user;
  const hybrid = bundle?.hybrid;
  const loadingStats = loadingBundle && !bundle;

  useEffect(() => {
    if (typeof document !== "undefined" && document.hidden) return;
    if (hybrid || user) setLastUpdatedAt(Date.now());
  }, [hybrid, user]);

  const currentVipLevel = Number(hybrid?.level ?? user?.level ?? 0);
  const depositUsd = Number(hybrid?.depositBalance ?? 0);
  const rewardUsd = Number(hybrid?.rewardBalance ?? 0);
  const totalBalanceUsd = depositUsd + rewardUsd;
  const stakingUsd = Number(hybrid?.activeStakeAmount ?? 0);

  const handleClaimRoi = async () => {
    if (roiLoading || hybrid?.canClaimRoi !== true || currentVipLevel < 1) return;
    try {
      setRoiLoading(true);
      await claimHybridRoi();
      showToast("success", "ROI claimed successfully");
      await mutateDashboardBundle();
    } catch (err: any) {
      const raw = getApiErrorMessage(err, "Could not claim ROI");
      const msg =
        err?.response?.status === 403 || /not allowed|forbidden/i.test(raw)
          ? "Action not allowed"
          : raw;
      showToast("error", msg);
    } finally {
      setRoiLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <PageWrapper
        loading={false}
        data={loadingBundle ? true : user?._id}
        emptyText="No data available"
      >
        <div className="relative w-full max-w-full overflow-x-hidden px-1 pb-24 text-white sm:px-0">
          <header className="relative z-10 flex flex-col gap-3 transition-opacity duration-300 ease-out sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">Smart Income Dashboard</h1>
            </div>
            <LiveRefreshIndicator lastUpdatedAt={lastUpdatedAt} className="sm:pt-1" />
          </header>

          {loadingStats ? (
            <StatTilesSkeleton cardClassName={CARD} />
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:mt-6 sm:grid-cols-2 sm:gap-3">
              <StatTile cardClassName={CARD} label="Total Balance" value={`$${totalBalanceUsd.toFixed(2)}`} />
              <StatTile cardClassName={CARD} label="Active Plan" value={`$${stakingUsd.toFixed(2)}`} />
            </div>
          )}

          {loadingStats ? (
            <RoiBlockSkeleton cardClass={CARD} />
          ) : (
            <DashboardRoiSection
              cardClass={CARD}
              hybrid={hybrid}
              roiLoading={roiLoading}
              currentVipLevel={currentVipLevel}
              handleClaimRoi={handleClaimRoi}
            />
          )}

          <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
            <QuickAction label="Deposit" icon="↓" onClick={() => router.push("/deposit")} />
            <QuickAction label="Withdraw" icon="↑" onClick={() => router.push("/withdraw")} />
            <QuickAction label="Stake" icon="◆" onClick={() => router.push("/staking")} />
            <QuickAction label="Team" icon="👥" onClick={() => router.push("/team")} />
          </div>
        </div>
      </PageWrapper>
    </ProtectedRoute>
  );
}

function StatTile({
  label,
  value,
  cardClassName,
}: {
  label: string;
  value: string;
  cardClassName: string;
}) {
  return (
    <div className={`${cardClassName} p-3 transition duration-300 ease-out hover:scale-[1.01] sm:p-4`}>
      <p className="text-[10px] text-gray-400 sm:text-xs">{label}</p>
      <h2 className="mt-1 text-xl font-bold tabular-nums text-white sm:mt-1.5 sm:text-2xl">{value}</h2>
    </div>
  );
}

function QuickAction({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-white/5 p-2 text-center backdrop-blur-xl transition duration-300 ease-out hover:border-emerald-500/35 hover:brightness-105 active:scale-[0.99] sm:min-h-[52px] sm:p-2.5"
    >
      <div className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 text-sm font-black text-gray-950 shadow-[0_2px_10px_rgba(16,185,129,0.28)]">
        {icon}
      </div>
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-gray-400">{label}</p>
    </button>
  );
}
