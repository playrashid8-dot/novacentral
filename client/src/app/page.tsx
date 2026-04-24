"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white space-y-4">

      <h1 className="text-3xl font-bold">🚀 NovaCentral</h1>

      <p className="text-gray-400">Hybrid Crypto Platform</p>

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => router.push("/login")}
          className="bg-purple-600 px-5 py-2 rounded-xl"
        >
          Login
        </button>

        <button
          onClick={() => router.push("/signup")}
          className="bg-green-600 px-5 py-2 rounded-xl"
        >
          Signup
        </button>
      </div>

    </div>
  );
}