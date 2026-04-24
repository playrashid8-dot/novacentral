"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import API from "../../lib/api";
import { motion } from "framer-motion";

export default function Signup() {
  const router = useRouter();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    referralCode: "",
  });

  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (loading) return;

    try {
      const username = form.username.trim();
      const email = form.email.trim();
      const password = form.password;

      if (!username || !email || !password) {
        return alert("All fields required");
      }

      if (!email.includes("@")) {
        return alert("Enter valid email");
      }

      setLoading(true);

      const res = await API.post("/auth/signup", {
        username,
        email,
        password,
        referralCode: form.referralCode || null,
      });

      // 🔥 CHECK RESPONSE
      if (!res.data?.token) {
        throw new Error("Signup failed - no token");
      }

      // 🔐 SAVE
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      alert("Account created successfully 🚀");

      router.push("/dashboard");

    } catch (err: any) {
      console.log("Signup Error:", err);

      alert(
        err?.response?.data?.msg ||
        err?.response?.data?.error ||
        "Signup failed ❌"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center text-white glow-bg relative">

      {/* BG */}
      <div className="absolute w-[400px] h-[400px] bg-purple-600 opacity-20 blur-[120px] top-[-100px] left-[-100px]" />
      <div className="absolute w-[400px] h-[400px] bg-indigo-600 opacity-20 blur-[120px] bottom-[-100px] right-[-100px]" />

      {/* CARD */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-[1px] rounded-3xl bg-gradient-to-r from-purple-500 to-indigo-500"
      >
        <div className="bg-[#0b0b0f]/90 p-6 rounded-3xl backdrop-blur-xl">

          <div className="text-center mb-6">
            <h1 className="text-gray-400">🚀 NovaCentral</h1>
            <h2 className="text-2xl font-bold mt-1">Create Account</h2>
          </div>

          <div className="space-y-4">

            <Input placeholder="Username" disabled={loading}
              onChange={(v:any)=>setForm({...form, username:v})} />

            <Input placeholder="Email" disabled={loading}
              onChange={(v:any)=>setForm({...form, email:v})} />

            <Input type="password" placeholder="Password" disabled={loading}
              onChange={(v:any)=>setForm({...form, password:v})} />

            <Input placeholder="Referral Code (optional)" disabled={loading}
              onChange={(v:any)=>setForm({...form, referralCode:v})} />

          </div>

          <button
            onClick={handleSignup}
            disabled={loading}
            className="mt-6 w-full btn disabled:opacity-50"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>

          <p className="text-center text-sm mt-4 text-gray-400">
            Already have account?{" "}
            <span
              onClick={() => router.push("/login")}
              className="text-purple-400 cursor-pointer"
            >
              Login
            </span>
          </p>

        </div>
      </motion.div>
    </div>
  );
}

function Input({ placeholder, type="text", onChange, disabled }:any){
  const [focus,setFocus]=useState(false);

  return (
    <div className="relative">
      <input
        type={type}
        disabled={disabled}
        onFocus={()=>setFocus(true)}
        onBlur={()=>setFocus(false)}
        onChange={(e)=>onChange(e.target.value)}
        className="input disabled:opacity-50"
      />
      <label className={`absolute left-3 transition-all ${
        focus ? "-top-2 text-xs text-purple-400 bg-[#0b0b0f] px-1"
        : "top-3 text-gray-400"
      }`}>
        {placeholder}
      </label>
    </div>
  );
}