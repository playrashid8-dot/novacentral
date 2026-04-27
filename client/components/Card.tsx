"use client";

import { motion } from "framer-motion";

export default function Card({
  children,
  className = "",
  variant = "glass",
}: any) {
  const styles: any = {
    glass:
      "bg-white/[0.07] backdrop-blur-2xl border border-white/10 shadow-[0_24px_80px_rgba(124,58,237,0.22)] hover:shadow-[0_0_42px_rgba(168,85,247,0.28)]",
    solid:
      "bg-[#0b0b0f]/95 border border-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.55)] hover:border-indigo-300/30",
    glow:
      "bg-gradient-to-br from-purple-500/20 via-indigo-500/15 to-cyan-500/10 backdrop-blur-2xl border border-purple-400/40 shadow-[0_0_55px_rgba(124,58,237,0.42)] hover:shadow-[0_0_72px_rgba(168,85,247,0.52)]",
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl p-4 transition-all duration-300 hover:border-purple-300/40 ${styles[variant]} ${className}`}
    >
      {children}
    </motion.div>
  );
}