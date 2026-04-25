"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import API from "../../lib/api";
import { saveUser } from "../../lib/auth";

/* ==============================
   🔥 WRAPPER (FIX BUILD ERROR)
============================== */
export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <SignupInner />
    </Suspense>
  );
}

/* ==============================
   🚀 SIGNUP COMPONENT
============================== */
function SignupInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [number, setNumber] = useState("");
  const [password, setPassword] = useState("");
  const [referral, setReferral] = useState("");

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  /* 🔗 AUTO REF */
  useEffect(() => {
    const ref = params.get("ref");
    if (ref) setReferral(ref);
  }, [params]);

  /* 🔔 TOAST */
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  /* 🚀 SIGNUP */
  const handleSignup = async () => {
    if (!username || !email || !password || !number) {
      return showToast("All fields required ⚠️");
    }

    if (password.length < 6) {
      return showToast("Password must be 6+ characters 🔒");
    }

    try {
      setLoading(true);

      const res = await API.post("/auth/register", {
        username,
        email,
        password,
        number,
        referralCode: referral,
      });

      saveUser(res.data);

      showToast("Account created 🚀");

      setTimeout(() => {
        router.push("/dashboard");
      }, 800);

    } catch (err: any) {
      showToast(err?.response?.data?.message || "Signup failed ❌");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden bg-[#040406] text-white">

      {/* 🔔 TOAST */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-purple-600 px-4 py-2 rounded-xl text-sm shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* 🌌 BACKGROUND */}
      <Glow />

      {/* 🔥 HEADER */}
      <Header />

      {/* 🧊 CARD */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm mt-16 p-[1px] rounded-3xl bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 shadow-[0_0_40px_rgba(139,92,246,0.4)]"
      >
        <div className="bg-[#0b0b0f]/90 backdrop-blur-xl p-6 rounded-3xl">

          <h2 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Create Account 🚀
          </h2>

          <Input label="Username" value={username} setValue={setUsername} />
          <Input label="Email" value={email} setValue={setEmail} type="email" />
          <Input label="Phone Number" value={number} setValue={setNumber} />
          <Input label="Password" value={password} setValue={setPassword} type="password" />
          <Input label="Referral Code (optional)" value={referral} setValue={setReferral} />

          <button
            onClick={handleSignup}
            disabled={loading}
            className="mt-4 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 p-3 rounded-xl font-semibold shadow-lg hover:scale-105 active:scale-95 transition flex items-center justify-center gap-2"
          >
            {loading && <Spinner />}
            {loading ? "Creating..." : "Signup 🚀"}
          </button>

          <p className="text-xs text-gray-400 text-center mt-5">
            Already have account?{" "}
            <span
              onClick={() => router.push("/login")}
              className="text-purple-400 cursor-pointer hover:underline"
            >
              Login
            </span>
          </p>

        </div>
      </motion.div>
    </div>
  );
}

/* ==============================
   🔹 COMPONENTS
============================== */

function Header() {
  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
      <Image
        src="/logo.png"
        alt="NovaCentral"
        width={36}
        height={36}
        className="rounded-full shadow-[0_0_20px_rgba(168,85,247,0.8)]"
      />
      <h1 className="font-bold text-lg bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
        NovaCentral
      </h1>
    </div>
  );
}

function Glow() {
  return (
    <>
      <div className="absolute w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[150px] top-[-150px] left-[-150px]" />
      <div className="absolute w-[500px] h-[500px] bg-indigo-600 opacity-20 blur-[150px] bottom-[-150px] right-[-150px]" />
    </>
  );
}

function Input({ label, value, setValue, type = "text" }: any) {
  return (
    <div className="mb-3">
      <p className="text-xs text-gray-400 mb-1">{label}</p>

      <input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={label}
        className="w-full bg-white/5 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none p-3 rounded-xl text-sm transition placeholder:text-gray-500"
      />
    </div>
  );
}

function Spinner() {
  return (
    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}

function Loader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#040406]">
      <Spinner />
    </div>
  );
}