"use client";

type Props = {
  cardClass: string;
  hybrid: any;
  tick: number;
  roiLoading: boolean;
  currentVipLevel: number;
  handleClaimRoi: () => void;
};

export default function DashboardRoiSection({
  cardClass,
  hybrid,
  tick,
  roiLoading,
  currentVipLevel,
  handleClaimRoi,
}: Props) {
  const roiRatePct = (Number(hybrid?.roiRate || 0) * 100).toFixed(2);
  const roiPrincipal = Number(hybrid?.roiPrincipalBase ?? 0);
  const canClaimRoi = hybrid?.canClaimRoi === true;

  const roiWaitLabel = (() => {
    void tick;
    const iso = hybrid?.nextRoiClaimAt;
    if (!iso || canClaimRoi) return canClaimRoi ? "Ready" : "";
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return "Ready";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (h >= 1) return `${h}h ${m}m`;
    if (m >= 1) return `${m}m ${s}s`;
    return `${s}s`;
  })();

  return (
    <div
      className={`mt-5 p-4 transition duration-300 ease-out hover:scale-[1.005] sm:p-5 ${cardClass}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400/85">Daily ROI</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="text-gray-400">
              Rate: <span className="font-bold text-white">{roiRatePct}%</span>
            </span>
            <span className="text-gray-400">
              Principal: <span className="font-bold tabular-nums text-white">${roiPrincipal.toFixed(2)}</span>
            </span>
          </div>
          {!canClaimRoi && hybrid?.nextRoiClaimAt ? (
            <p className="text-sm text-gray-400">
              Next claim:{" "}
              <span className="font-mono font-semibold text-emerald-200/95">{roiWaitLabel}</span>
            </p>
          ) : (
            <p className="text-sm font-semibold text-emerald-200/95">Ready to claim</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleClaimRoi}
          disabled={roiLoading || !canClaimRoi || currentVipLevel < 1}
          className="inline-flex min-h-[48px] w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-400 px-6 py-3 text-sm font-black text-gray-950 transition duration-300 ease-out hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
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
      {currentVipLevel < 1 && (
        <p className="mt-3 text-[11px] text-gray-500">Reach VIP 1 to unlock manual ROI claims.</p>
      )}
    </div>
  );
}
