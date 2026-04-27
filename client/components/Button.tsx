"use client";

import { motion } from "framer-motion";

export default function Button({
  children,
  onClick,
  loading = false,
  disabled = false,
  variant = "primary",
  className = "",
}: any) {
  const base =
    "w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300 active:scale-95";

  const styles: any = {
    primary:
      "bg-gradient-to-r from-[#7c3aed] via-[#a855f7] to-[#4f46e5] text-white shadow-[0_0_30px_rgba(124,58,237,0.5)] hover:shadow-[0_0_42px_rgba(168,85,247,0.72)]",
    secondary:
      "bg-white/10 border border-white/10 text-white backdrop-blur-xl hover:border-purple-400/50 hover:bg-purple-500/20 hover:shadow-[0_0_24px_rgba(124,58,237,0.25)]",
    ghost: "text-gray-400 hover:text-white hover:bg-white/5 hover:shadow-[0_0_20px_rgba(124,58,237,0.18)]",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${styles[variant]} ${
        disabled || loading ? "opacity-50 cursor-not-allowed" : "hover:scale-105"
      } ${className}`}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      )}
      {loading ? "Please wait..." : children}
    </motion.button>
  );
}