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
      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="mb-4"
        >
          <Image
            src="/logo.png"
            alt=""
            width={56}
            height={56}
            className="rounded-full shadow-md shadow-[#6366F1]/25"
          />
        </motion.div>

        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="h-10 w-10 rounded-full border-2 border-[#6366F1] border-t-transparent"
          aria-hidden
        />

        <p className="mt-3 text-xs tracking-wide text-gray-500">Loading…</p>
        <span className="sr-only">Loading</span>
      </div>
    </div>
  );
}
