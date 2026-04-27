"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import API, { getApiErrorMessage } from "../../lib/api";
import { resetLogoutState } from "../../lib/auth";

export default function Login() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const handleLogin = async () => {
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      return showToast("All fields required ⚠️");
    }

    if (cleanUsername.length < 3) {
      return showToast("Username must be at least 3 characters ⚠️");
    }

    if (cleanPassword.length < 8) {
      return showToast("Password must be at least 8 characters 🔒");
    }

    try {
      setLoading(true);
      resetLogoutState();

      await API.post("/auth/login", {
        username: cleanUsername,
        password: cleanPassword,
      });

      showToast("Login successful ✅");
      router.replace("/dashboard");

    } catch (err: any) {
      showToast(getApiErrorMessage(err, "Login failed ❌"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden bg-[#040406] text-white">
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-purple-600 px-4 py-2 rounded-xl text-sm shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* 🌌 BACKGROUND */}
      <div className="absolute w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[150px] top-[-150px] left-[-150px]" />
      <div className="absolute w-[500px] h-[500px] bg-indigo-600 opacity-20 blur-[150px] bottom-[-150px] right-[-150px]" />

      {/* 🔥 HEADER */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <Image
          src="/logo.png"
          alt="HybridEarn"
          width={36}
          height={36}
          className="rounded-full shadow-[0_0_20px_rgba(168,85,247,0.8)]"
        />
        <h1 className="font-bold text-lg bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
          HybridEarn
        </h1>
      </div>

      {/* 🧊 CARD */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm mt-16 p-[1px] rounded-3xl bg-gradient-to-r from-purple-500 to-indigo-500"
      >
        <div className="bg-[#0b0b0f]/90 backdrop-blur-xl p-6 rounded-3xl">

          {/* TITLE */}
          <h2 className="text-2xl font-bold text-center mb-2 text-glow">
            Welcome to HybridEarn
          </h2>
          <p className="mb-6 text-center text-xs text-gray-400">
            Premium glass access for daily ROI, referrals, and rewards.
          </p>

          {/* USERNAME */}
          <Input
            label="Username"
            value={username}
            setValue={setUsername}
          />

          {/* PASSWORD */}
          <Input
            label="Password"
            value={password}
            setValue={setPassword}
            type="password"
          />

          {/* BUTTON */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="mt-4 w-full bg-gradient-to-r from-purple-500 to-indigo-500 p-3 rounded-xl font-semibold shadow-lg hover:scale-105 active:scale-95 transition flex items-center justify-center gap-2"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {loading ? "Logging in..." : "Login 🔐"}
          </button>

          {/* SIGNUP */}
          <p className="text-xs text-gray-400 text-center mt-5">
            Don’t have an account?{" "}
            <span
              onClick={() => router.push("/signup")}
              className="text-purple-400 cursor-pointer hover:underline"
            >
              Signup
            </span>
          </p>

        </div>
      </motion.div>
    </div>
  );
}

/* 🔹 INPUT COMPONENT */
function Input({ label, value, setValue, type = "text" }: any) {
  return (
    <div className="mb-3">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full bg-white/5 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none p-3 rounded-xl text-sm transition"
        placeholder={label}
      />
    </div>
  );
}