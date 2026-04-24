"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import API from "../../lib/api";

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
    try {
      if (!form.username || !form.email || !form.password) {
        return alert("All fields required");
      }

      setLoading(true);

      const res = await API.post("/auth/register", form);

      // 🔐 SAVE TOKEN
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      alert("Signup successful 🚀");

      router.push("/dashboard");

    } catch (err: any) {
      alert(err?.response?.data?.msg || "Signup failed ❌");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center text-white">

      <div className="w-full max-w-md p-6 bg-black rounded-xl">

        <h2 className="text-xl mb-4">Signup</h2>

        <input placeholder="Username"
          onChange={(e)=>setForm({...form, username:e.target.value})}
          className="input" />

        <input placeholder="Email"
          onChange={(e)=>setForm({...form, email:e.target.value})}
          className="input mt-2" />

        <input type="password" placeholder="Password"
          onChange={(e)=>setForm({...form, password:e.target.value})}
          className="input mt-2" />

        <input placeholder="Referral Code"
          onChange={(e)=>setForm({...form, referralCode:e.target.value})}
          className="input mt-2" />

        <button onClick={handleSignup}
          className="btn mt-4 w-full">
          {loading ? "Loading..." : "Signup"}
        </button>

      </div>
    </div>
  );
}