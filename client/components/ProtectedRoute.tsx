"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdmin, isAuth } from "../lib/auth";
import { motion } from "framer-motion";

export default function ProtectedRoute({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const verifyAuth = async () => {
      try {
        const ok = await isAuth();

        if (!mounted) return;

        if (!ok) {
          setRedirecting(true);
          router.replace("/login");
        } else if (adminOnly && !isAdmin()) {
          setRedirecting(true);
          router.replace("/dashboard");
        } else {
          setChecking(false);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        setRedirecting(true);
        router.replace("/login");
      }
    };

    verifyAuth();

    return () => {
      mounted = false;
    };
  }, [adminOnly, router]);

  // 🔥 PREMIUM LOADER
  if (checking || redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#040406] text-white">

        {/* 🌌 BACKGROUND GLOW */}
        <div className="absolute w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[150px] top-[-150px] left-[-150px]" />
        <div className="absolute w-[500px] h-[500px] bg-indigo-600 opacity-20 blur-[150px] bottom-[-150px] right-[-150px]" />

        {/* LOADER */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />

          <p className="text-sm text-gray-400">
            Checking authentication...
          </p>
        </motion.div>
      </div>
    );
  }

  // ✅ AUTHORIZED
  return <>{children}</>;
}