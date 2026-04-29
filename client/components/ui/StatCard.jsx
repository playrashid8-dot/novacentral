export default function StatCard({ title, value, subtitle, hint, className = "" }) {
  return (
    <div
      className={`bg-card rounded-2xl p-4 shadow-soft ring-1 ring-white/[0.04] transition hover:ring-emerald-500/20 ${className}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">{title}</p>
      <p className="mt-2 text-xl font-black tabular-nums tracking-tight text-white sm:text-2xl">{value}</p>
      {subtitle ? <p className="mt-1 text-[11px] leading-snug text-gray-500">{subtitle}</p> : null}
      {hint ? <p className="mt-2 text-[10px] text-emerald-200/70">{hint}</p> : null}
    </div>
  );
}
