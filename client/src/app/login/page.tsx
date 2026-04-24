"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import API from "../../lib/api";

export default function Login() {
  const router = useRouter();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      if (!form.email || !form.password) {
        return alert("Enter email & password");
      }

      setLoading(true);

      const res = await API.post("/auth/login", form);

      // 🔐 SAVE TOKEN
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      alert("Login successful 🚀");

      router.push("/dashboard");

    } catch (err: any) {
      alert(err?.response?.data?.msg || "Login failed ❌");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center text-white">

      <div className="w-full max-w-md p-6 bg-black rounded-xl">

        <h2 className="text-xl mb-4">Login</h2>

        <input placeholder="Email"
          onChange={(e)=>setForm({...form, email:e.target.value})}
          className="input" />

        <input type="password" placeholder="Password"
          onChange={(e)=>setForm({...form, password:e.target.value})}
          className="input mt-2" />

        <button onClick={handleLogin}
          className="btn mt-4 w-full">
          {loading ? "Loading..." : "Login"}
        </button>

      </div>
    </div>
  );
}