"use client";

import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";

export default function Sidebar() {
  const router = useRouter();
  const path = usePathname();

  const menu = [
    { name: "Dashboard", path: "/dashboard", icon: "🏠" },
    { name: "Deposit", path: "/deposit", icon: "💰" },
    { name: "Investment", path: "/investment", icon: "📊" },
    { name: "Withdraw", path: "/withdrawal", icon: "💸" },
    { name: "Referral", path: "/referral", icon: "👥" },
    { name: "VIP", path: "/vip", icon: "👑" },
    { name: "Profile", path: "/profile", icon: "👤" },
  ];

  return (
    <div className="hidden md:flex flex-col w-64 min-h-screen relative">

      {/* 🌌 BACKGROUND */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl border-r border-white/10" />

      {/* CONTENT */}
      <div className="relative z-10 flex flex-col h-full p-5">

        {/* 🔥 LOGO */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.6)]">
            🚀
          </div>

          <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            NovaCentral
          </h1>
        </div>

        {/* 📌 MENU */}
        <div className="flex flex-col gap-2">

          {menu.map((item) => {
            const active = path === item.path;

            return (
              <button
                key={item.name}
                onClick={() => router.push(item.path)}
                className="relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition group"
              >
                {/* ACTIVE BG */}
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl bg-purple-500/20"
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                )}

                {/* ICON */}
                <span
                  className={`text-lg ${
                    active ? "text-purple-400" : "text-gray-400"
                  }`}
                >
                  {item.icon}
                </span>

                {/* TEXT */}
                <span
                  className={`${
                    active
                      ? "text-purple-400 font-medium"
                      : "text-gray-400 group-hover:text-white"
                  }`}
                >
                  {item.name}
                </span>
              </button>
            );
          })}

        </div>

        {/* ⚡ FOOTER */}
        <div className="mt-auto pt-6 border-t border-white/5">
          <p className="text-xs text-gray-500">
            © 2026 NovaCentral
          </p>
        </div>

      </div>
    </div>
  );
}