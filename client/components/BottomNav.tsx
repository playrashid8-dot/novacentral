"use client";

import { useRouter, usePathname } from "next/navigation";

export default function BottomNav() {
  const router = useRouter();
  const path = usePathname();

  const nav = [
    { name: "Home", path: "/dashboard" },
    { name: "Invest", path: "/investment" },
    { name: "Referral", path: "/referral" },
    { name: "Profile", path: "/profile" },
  ];

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[95%] max-w-[420px] bg-black/80 border border-white/10 rounded-xl flex justify-around py-3">

      {nav.map((item) => (
        <button
          key={item.name}
          onClick={() => router.push(item.path)}
          className={
            path === item.path
              ? "text-purple-400"
              : "text-gray-400"
          }
        >
          {item.name}
        </button>
      ))}

    </div>
  );
}