"use client";

import { useState } from "react";
import API from "../../lib/api";
import { useRouter } from "next/navigation";

export default function Signup() {
  const router = useRouter();

  const [form, setForm] = useState({
    username: "",
    email: "",
    phone: "",
    password: "",
    referral: "",
  });

  const handleSignup = async () => {
    try {
      await API.post("/auth/signup", form);
      alert("Signup success");
      router.push("/login");
    } catch {
      alert("Signup failed");
    }
  };

  return (
    <div className="space-y-5">

      <h1 className="text-2xl font-bold text-center">Create Account</h1>

      <div className="card space-y-3">

        <input
          className="input"
          placeholder="Username"
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />

        <input
          className="input"
          placeholder="Email"
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <input
          className="input"
          placeholder="Phone Number"
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />

        <input
          className="input"
          type="password"
          placeholder="Password"
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        <input
          className="input"
          placeholder="Referral Code (optional)"
          onChange={(e) => setForm({ ...form, referral: e.target.value })}
        />

        <button onClick={handleSignup} className="btn">
          Signup
        </button>

      </div>

    </div>
  );
}