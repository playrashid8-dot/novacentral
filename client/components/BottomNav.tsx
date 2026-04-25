"use client";

import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";

export default function BottomNav() {
  const router = useRouter();
  const path = usePathname();

  const nav = [
    { name: "Home", path: "/dashboard", icon: "🏠" },
    { name: "Team", path: "/referral", icon: "👥" },
    { name: "History", path: "/history", icon: "📜" },
    { name: "Profile", path: "/profile", icon: "👤" },
  ];

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] max-w-[420px] z-50">

      <div className="bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl flex justify-around py-3 shadow-xl">

        {nav.map((item) => {
          const active = path === item.path;

          return (
            <button
              key={item.name}
              onClick={() => router.push(item.path)}
              className="relative flex flex-col items-center text-xs"
            >

              {/* 🔥 ACTIVE GLOW */}
              {active && (
                <motion.div
                  layoutId="nav-glow"
                  className="absolute -top-1 w-10 h-10 bg-purple-500/20 blur-xl rounded-full"
                />
              )}

              {/* ICON */}
              <motion.div
                animate={{ scale: active ? 1.2 : 1 }}
                transition={{ duration: 0.2 }}
                className={active ? "text-purple-400" : "text-gray-400"}
              >
                {item.icon}
              </motion.div>

              {/* LABEL */}
              <span
                className={`mt-1 ${
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