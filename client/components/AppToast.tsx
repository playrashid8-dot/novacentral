"use client";

type Props = {
  message: string;
  /** success = emerald, error = red, neutral = toast default */
  tone?: "neutral" | "success" | "error";
};

const toneClass: Record<NonNullable<Props["tone"]>, string> = {
  neutral: "bg-purple-600 text-white shadow-lg",
  success: "bg-emerald-600/95 text-white shadow-[0_8px_32px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400/30",
  error:
    "bg-red-600/95 text-white shadow-[0_8px_32px_rgba(220,38,38,0.35)] ring-1 ring-red-400/30",
};

export default function AppToast({ message, tone = "neutral" }: Props) {
  if (!message) return null;

  return (
    <div
      role="status"
      className={`fixed top-20 left-1/2 z-[60] max-w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl px-4 py-2.5 text-center text-sm font-semibold backdrop-blur-sm ${toneClass[tone]}`}
    >
      {message}
    </div>
  );
}
