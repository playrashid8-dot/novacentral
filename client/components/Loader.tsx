"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function Loader({
  full = true,
}: {
  full?: boolean;
}) {
  if (!full) {
    return (
      <div className="flex items-center justify-center py-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="h-10 w-10 rounded-full border-2 border-[#6366F1] border-t-transparent"
          aria-hidden
        />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B0F19]">
      <div className="pointer-events-none absolute left-[-80px] top-[-80px] h-[320px] w-[320px] rounded-full bg-[#6366F1]/20 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-[-80px] right-[-80px] h-[300px] w-[300px] rounded-full bg-indigo-600/15 blur-[100px]" />

      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35 }}
          className="mb-5"
        >
          <Image
            src="/logo.png"
            alt=""
            width={64}
            height={64}
            className="rounded-full shadow-[0_0_28px_rgba(99,102,241,0.55)]"
          />
        </motion.div>

        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="h-10 w-10 rounded-full border-2 border-[#6366F1] border-t-transparent"
          aria-hidden
        />

        <p className="mt-4 text-xs tracking-wide text-gray-500">Loading…</p>
        <span className="sr-only">Loading</span>
      </div>
    </div>
  );
}
