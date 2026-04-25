"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function Loader({
  full = true, // full screen ya inline
}: {
  full?: boolean;
}) {
  // 🔹 INLINE LOADER
  if (!full) {
    return (
      <div className="flex items-center justify-center">
        <span className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 🔥 FULL SCREEN LOADER
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#040406]">

      {/* 🌌 BACKGROUND GLOW */}
      <div className="absolute w-[400px] h-[400px] bg-purple-600 opacity-20 blur-[120px] top-[-100px] left-[-100px]" />
      <div className="absolute w-[400px] h-[400px] bg-indigo-600 opacity-20 blur-[120px] bottom-[-100px] right-[-100px]" />

      {/* 🔲 GRID */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.05)_1px,_transparent_1px)] [background-size:26px_26px]" />

      {/* 🔥 CONTENT */}
      <div className="relative z-10 flex flex-col items-center">

        {/* LOGO */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="mb-5"
        >
          <Image
            src="/logo.png"
            alt="NovaCentral"
            width={65}
            height={65}
            className="rounded-full shadow-[0_0_30px_rgba(168,85,247,0.8)]"
          />
        </motion.div>

        {/* SPINNER */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full"
        />

        {/* TEXT */}
        <p className="text-xs text-gray-400 mt-4 tracking-wide">
          Loading NovaCentral...
        </p>

      </div>
    </div>
  );
}