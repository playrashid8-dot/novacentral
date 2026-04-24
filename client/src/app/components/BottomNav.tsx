"use client";

import { usePathname, useRouter } from "next/navigation";

export default function BottomNav() {
  const router = useRouter();
  const path = usePathname();

  const tabs = [
    { name: "Home", path: "/" },
    { name: "Wallet", path: "/wallet" },
    { name: "Team", path: "/team" },
    { name: "Profile", path: "/profile" },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full bg-black/70 backdrop-blur-xl border-t border-white/10">
      <div className="max-w-md mx-auto flex justify-around py-3">

        {tabs.map((tab) => (
          <button
            key={tab.name}
            onClick={() => router.push(tab.path)}
            className={`flex flex-col items-center text-sm ${
              path === tab.path
                ? "text-purple-400"
                : "text-gray-400"
            }`}
          >
            <span>{tab.name}</span>
          </button>
        ))}

      </div>
    </div>
  );
}