"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/`)
      .then((res) => res.text())
      .then((data) => setMsg(data))
      .catch(() => setMsg("API not connected"));
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-4xl font-bold mb-4 text-green-400">
        NovaCentral 🚀
      </h1>

      <p className="text-gray-300 mb-6">
        Earn Smart with automated crypto system
      </p>

      <div className="bg-gray-800 p-4 rounded-lg mb-6">
        <p className="text-sm text-gray-400">Backend Status:</p>
        <p className="text-green-400 font-bold">{msg}</p>
      </div>

      <div className="flex gap-4">
        <Link href="/login">
          <button className="bg-green-500 px-6 py-2 rounded font-bold hover:bg-green-600">
            Login
          </button>
        </Link>

        <Link href="/signup">
          <button className="bg-blue-500 px-6 py-2 rounded font-bold hover:bg-blue-600">
            Signup
          </button>
        </Link>
      </div>
    </div>
  );
}