"use client";

type Props = {
  cardClass: string;
  hybrid: any;
  roiLoading: boolean;
  currentVipLevel: number;
  handleClaimRoi: () => void;
};

export default function DashboardRoiSection({
  cardClass,
  hybrid,
  roiLoading,
  currentVipLevel,
  handleClaimRoi,
}: Props) {
  const roiRatePct = (Number(hybrid?.roiRate || 0) * 100).toFixed(2);
  const canClaimRoi = hybrid?.canClaimRoi === true;

  return (
    <div className={`mt-5 p-4 transition duration-300 ease-out hover:scale-[1.005] sm:p-5 ${cardClass}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-400">
          Rate: <span className="font-bold tabular-nums text-white">{roiRatePct}%</span>
        </p>
        <button
          type="button"
          onClick={handleClaimRoi}
          disabled={roiLoading || !canClaimRoi || currentVipLevel < 1}
          className="inline-flex min-h-[48px] w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-400 px-6 py-3 text-sm font-black text-gray-950 transition duration-300 ease-out hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:min-w-[140px]"
        >
          {roiLoading ? (
            <>
              <span
                className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-gray-900/35 border-t-gray-900"
                aria-hidden
              />
              Claiming…
            </>
          ) : (
            "Claim ROI"
          )}
        </button>
      </div>
    </div>
  );
}
