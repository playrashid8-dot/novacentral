"use client";

import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";

export default function Navbar() {
  const router = useRouter();
  const path = usePathname();

  const navItems = [
    { name: "Home", path: "/dashboard", icon: "🏠" },
    { name: "Invest", path: "/investment", icon: "📊" },
    { name: "Team", path: "/referral", icon: "👥" },
    { name: "Profile", path: "/profile", icon: "👤" },
  ];

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[95%] max-w-[420px] z-50">

      {/* 🔥 GLASS CONTAINER */}
      <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl flex justify-around py-3 shadow-[0_0_25px_rgba(139,92,246,0.3)]">

        {navItems.map((item) => {
          const active = path === item.path;

          return (
            <button
              key={item.name}
              onClick={() => router.push(item.path)}
              className="relative flex flex-col items-center text-xs transition"
            >
              {/* ACTIVE BG */}
              {active && (
                <motion.div
                  layoutId="nav-bg"
                  className="absolute -inset-2 rounded-xl bg-purple-500/20"
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
                className={`mt-1 ${
                  active ? "text-purple-400" : "text-gray-400"
                }`}
              >
                {item.name}
              </span>
            </button>
          );
        })}

      </div>
    </div>
  );
}