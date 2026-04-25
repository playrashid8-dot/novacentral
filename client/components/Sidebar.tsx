"use client";

import { useRouter, usePathname } from "next/navigation";

export default function Sidebar() {
  const router = useRouter();
  const path = usePathname();

  const menu = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Deposit", path: "/deposit" },
    { name: "Investment", path: "/investment" },
    { name: "Withdraw", path: "/withdrawal" },
    { name: "Referral", path: "/referral" },
    { name: "VIP", path: "/vip" },
    { name: "Profile", path: "/profile" },
  ];

  return (
    <div className="hidden md:flex flex-col w-64 min-h-screen bg-black/80 border-r border-white/10 p-4">

      {/* LOGO */}
      <h1 className="text-xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
        NovaCentral
      </h1>

      {/* MENU */}
      <div className="flex flex-col gap-2">
        {menu.map((item) => (
          <button
            key={item.name}
            onClick={() => router.push(item.path)}
            className={`text-left px-4 py-2 rounded-lg transition ${
              path === item.path
                ? "bg-purple-500/20 text-purple-400"
                : "text-gray-400 hover:bg-white/5"
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>

      {/* FOOTER */}
      <div className="mt-auto text-xs text-gray-500">
        © NovaCentral
      </div>
    </div>
  );
}