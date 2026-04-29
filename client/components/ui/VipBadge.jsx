export default function VipBadge({ level = 0, className = "" }) {
  const n = Math.max(0, Math.min(99, Number(level) || 0));
  return (
    <span
      className={`inline-flex items-center rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-gray-900 shadow-[0_0_20px_rgba(251,191,36,0.45)] ${className}`}
    >
      VIP {n}
    </span>
  );
}
