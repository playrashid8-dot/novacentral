"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import API from "../../lib/api";
import { saveUser } from "../../lib/auth";

export default function Signup() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async () => {
    try {
      const res = await API.post("/auth/register", {
        username,
        email,
        password,
      });

      saveUser(res.data);

      router.push("/dashboard");
    } catch (err: any) {
      alert(err?.response?.data?.message || "Signup failed ❌");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center text-white">
      <div className="card w-full max-w-sm">
        <h1 className="text-xl font-bold mb-4">Signup</h1>

        <input className="input mb-2" placeholder="Username" onChange={(e)=>setUsername(e.target.value)} />
        <input className="input mb-2" placeholder="Email" onChange={(e)=>setEmail(e.target.value)} />
        <input className="input mb-3" type="password" placeholder="Password" onChange={(e)=>setPassword(e.target.value)} />

        <button onClick={handleSignup} className="btn w-full">Signup</button>
      </div>
    </div>
  );
}