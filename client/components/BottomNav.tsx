"use client";

import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";

export default function BottomNav() {
  const router = useRouter();
  const path = usePathname();

  const nav = [
    { name: "Home", path: "/dashboard", icon: "🏠" },
    { name: "Earnings", path: "/earnings", icon: "📈" },
    { name: "Team", path: "/team", icon: "👥" },
    { name: "Wallet", path: "/wallet", icon: "💰" },
    { name: "Profile", path: "/profile", icon: "👤" },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full z-50 px-3 pb-3">

      {/* GLASS CONTAINER */}
      <div className="bg-[#0b0b0f]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex justify-between items-center px-2 py-2">

        {nav.map((item) => {
          const active = path === item.path;

          return (
            <button
              key={item.name}
              onClick={() => router.push(item.path)}
              className="flex flex-col items-center justify-center flex-1 relative"
            >
              {/* ACTIVE BACKGROUND */}
              {active && (
                <motion.div
                  layoutId="navActive"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/20 to-indigo-500/20 blur-md"
                />
              )}

              {/* ICON */}
              <span
                className={`text-lg relative z-10 transition ${
                  active
                    ? "text-purple-400 scale-110"
                    : "text-gray-400"
                }`}
              >
                {item.icon}
              </span>

              {/* LABEL */}
              <span
                className={`text-[10px] mt-1 relative z-10 ${
                  active ? "text-purple-400" : "text-gray-500"
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