"use client";

import { useState } from "react";
import API from "../../lib/api";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const res = await API.post("/auth/login", {
        username,
        password,
      });

      localStorage.setItem("token", res.data.token);
      router.push("/dashboard");

    } catch {
      alert("Login failed");
    }
  };

  return (
    <div className="space-y-5">

      <h1 className="text-2xl font-bold text-center">Login</h1>

      <div className="card space-y-3">

        <input
          className="input"
          placeholder="Username"
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          className="input"
          type="password"
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={handleLogin} className="btn">
          Login
        </button>

        <p
          onClick={() => alert("Forgot password system later")}
          className="text-sm text-center text-gray-400 cursor-pointer"
        >
          Forgot Password?
        </p>

      </div>

    </div>
  );
}