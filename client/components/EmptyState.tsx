"use client";

export default function EmptyState({
  text = "No data available",
  title,
  className = "",
}: {
  text?: string;
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-[#111827]/80 px-6 py-10 text-center shadow-inner ring-1 ring-white/[0.04] ${className}`}
      role="status"
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6366F1]/15 text-xl ring-1 ring-[#6366F1]/25">
        ∅
      </div>
      {title ? (
        <p className="text-sm font-semibold text-white">{title}</p>
      ) : null}
      <p className={`text-sm text-gray-400 ${title ? "mt-1" : ""}`}>{text}</p>
    </div>
  );
}
