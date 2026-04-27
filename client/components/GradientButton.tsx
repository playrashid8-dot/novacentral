"use client";

import { motion } from "framer-motion";

export default function GradientButton({
  children,
  onClick,
  loading = false,
  disabled = false,
  className = "",
  type = "button",
}: any) {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      type={type}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      disabled={isDisabled}
      className={`w-full rounded-xl bg-gradient-to-r from-[#7c3aed] via-[#a855f7] to-[#2563eb] px-4 py-3 text-sm font-bold text-white shadow-[0_0_32px_rgba(124,58,237,0.48)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_46px_rgba(168,85,247,0.68)] disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
    >
      <span className="flex items-center justify-center gap-2">
        {loading && (
          <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
        )}
        {children}
      </span>
    </motion.button>
  );
}
