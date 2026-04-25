"use client";

import { useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();

  return (
    <div className="fixed bottom-0 w-full bg-black border-t border-white/10 flex justify-around py-3 text-white">
      <button onClick={() => router.push("/dashboard")}>Home</button>
      <button onClick={() => router.push("/investment")}>Invest</button>
      <button onClick={() => router.push("/referral")}>Team</button>
      <button onClick={() => router.push("/profile")}>Profile</button>
    </div>
  );
}