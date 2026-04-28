"use client";

export default function EmptyState({
  text = "No data available",
  className = "",
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-8 text-center text-sm text-gray-400 ${className}`}
    >
      {text}
    </div>
  );
}
