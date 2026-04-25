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
    "w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition";

  const styles: any = {
    primary:
      "bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg",
    secondary:
      "bg-white/10 border border-white/10 text-white",
    ghost: "text-gray-400 hover:text-white",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${styles[variant]} ${
        disabled ? "opacity-50" : "hover:scale-105"
      } ${className}`}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      )}
      {loading ? "Please wait..." : children}
    </motion.button>
  );
}