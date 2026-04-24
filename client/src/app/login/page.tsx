"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Login() {
  const router = useRouter();

  const [form, setForm] = useState({
    username: "",
    password: "",
  });

  const handleLogin = () => {
    if (form.username && form.password) {
      router.push("/dashboard");
    } else {
      alert("Fill required fields");
    }
  };

  return (
    <div className="min-h-screen bg-[#07070a] flex items-center justify-center text-white relative overflow-hidden">

      {/* 🔥 ANIMATED BACKGROUND */}
      <div className="absolute w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[120px] animate-pulse top-[-150px] left-[-150px]" />
      <div className="absolute w-[500px] h-[500px] bg-indigo-600 opacity-20 blur-[120px] animate-pulse bottom-[-150px] right-[-150px]" />

      {/* GRID OVERLAY */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.05)_1px,_transparent_1px)] [background-size:30px_30px]" />

      {/* MAIN CARD */}
      <div className="relative w-full max-w-md p-[1px] rounded-3xl bg-gradient-to-r from-purple-500 to-indigo-500">

        <div className="rounded-3xl bg-[#0b0b0f]/90 backdrop-blur-xl p-6 shadow-2xl">

          {/* HEADER */}
          <div className="text-center mb-6">
            <h1 className="text-lg text-gray-400">🚀 NovaCentral</h1>
            <h2 className="text-2xl font-bold mt-1">Welcome Back</h2>
          </div>

          {/* INPUTS */}
          <div className="space-y-4">

            <Input
              placeholder="Username"
              onChange={(v:any)=>setForm({...form, username:v})}
            />

            <Input
              type="password"
              placeholder="Password"
              onChange={(v:any)=>setForm({...form, password:v})}
            />

          </div>

          {/* FORGOT PASSWORD */}
          <div className="text-right mt-2">
            <span className="text-sm text-purple-400 cursor-pointer hover:underline">
              Forgot Password?
            </span>
          </div>

          {/* BUTTON */}
          <button
            onClick={handleLogin}
            className="mt-5 w-full bg-gradient-to-r from-purple-500 to-indigo-500 p-3 rounded-xl font-semibold shadow-lg hover:scale-105 hover:shadow-purple-500/30 transition-all duration-300"
          >
            Login
          </button>

          {/* FOOTER */}
          <p className="text-center text-sm mt-4 text-gray-400">
            Don't have an account?{" "}
            <span
              onClick={()=>router.push("/signup")}
              className="text-purple-400 cursor-pointer hover:underline"
            >
              Signup
            </span>
          </p>

        </div>
      </div>
    </div>
  );
}

/* 🔥 SAME PREMIUM INPUT */
function Input({ placeholder, type = "text", onChange }: any) {
  const [focus, setFocus] = useState(false);

  return (
    <div className="relative">

      <input
        type={type}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-3 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-purple-500 transition"
      />

      {/* FLOAT LABEL */}
      <label
        className={`absolute left-3 transition-all duration-200 ${
          focus
            ? "-top-2 text-xs text-purple-400 bg-[#0b0b0f] px-1"
            : "top-3 text-gray-400"
        }`}
      >
        {placeholder}
      </label>

    </div>
  );
}