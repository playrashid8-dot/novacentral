"use client";

import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
};

export default function Button({
  className = "",
  variant = "primary",
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const base =
    "rounded-2xl px-4 py-3 text-sm font-semibold shadow-md transition hover:scale-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100";

  const variants = {
    primary:
      "bg-gradient-to-r from-[#6366F1] to-indigo-600 text-white hover:shadow-[0_8px_30px_rgba(99,102,241,0.35)]",
    ghost: "bg-white/[0.06] text-gray-200 ring-1 ring-white/10 hover:bg-white/[0.1]",
    outline:
      "bg-transparent text-indigo-200 ring-1 ring-indigo-500/40 hover:bg-indigo-500/10",
  } as const;

  return (
    <button
      type={type}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
