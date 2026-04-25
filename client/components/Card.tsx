"use client";

import { motion } from "framer-motion";

export default function Card({
  children,
  className = "",
  variant = "glass",
}: any) {
  const styles: any = {
    glass: "bg-white/5 backdrop-blur-xl border border-white/10",
    solid: "bg-[#0b0b0f] border border-white/5",
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`rounded-2xl p-4 shadow-lg ${styles[variant]} ${className}`}
    >
      {children}
    </motion.div>
  );
}