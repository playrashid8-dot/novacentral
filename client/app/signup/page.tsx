"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import API, { getApiErrorMessage, initCSRF } from "../../lib/api";

import PrimaryButton from "../../components/PrimaryButton";

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
  const [otp, setOtp] = useState("");
  const [otpSending, setOtpSending] = useState(false);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const normalizePhone = (value: string) => value.replace(/[^\d+]/g, "");

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

  const handleSendSignupOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      return showToast("Enter a valid email first ⚠️");
    }

    try {
      setOtpSending(true);
      await initCSRF();
      await API.post("/auth/send-signup-otp", { email: cleanEmail });
      showToast("Check your email for the code 📬");
    } catch (err: any) {
      showToast(getApiErrorMessage(err, "Could not send code ❌"));
    } finally {
      setOtpSending(false);
    }
  };

  /* 🚀 SIGNUP */
  const handleSignup = async () => {
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = normalizePhone(number.trim());
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanEmail || !cleanPassword || !cleanPhone) {
      return showToast("All fields required ⚠️");
    }

    if (cleanUsername.length < 3) {
      return showToast("Username must be at least 3 characters ⚠️");
    }

    if (!isValidEmail(cleanEmail)) {
      return showToast("Enter a valid email address ⚠️");
    }

    if (!/^\+?\d{10,15}$/.test(cleanPhone)) {
      return showToast("Enter a valid phone number ⚠️");
    }

    if (cleanPassword.length < 8) {
      return showToast("Password must be at least 8 characters 🔒");
    }

    const otpClean = otp.trim();
    if (!/^\d{6}$/.test(otpClean)) {
      return showToast("Enter the 6-digit code from your email ⚠️");
    }

    try {
      setLoading(true);

      await initCSRF();
      await API.post("/auth/register", {
        username: cleanUsername,
        email: cleanEmail,
        password: cleanPassword,
        number: cleanPhone,
        referralCode: referral.trim(),
        otp: otpClean,
      });

      showToast("Account created 🚀");

      setTimeout(() => {
        router.push("/dashboard");
      }, 800);

    } catch (err: any) {
      showToast(getApiErrorMessage(err, "Signup failed ❌"));
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
            Welcome to HybridEarn
          </h2>

          <Input label="Username" value={username} setValue={setUsername} />
          <div className="mb-3">
            <p className="text-xs text-gray-400 mb-1">Email</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="flex-1 bg-white/5 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none p-3 rounded-xl text-sm placeholder:text-gray-500"
              />
              <button
                type="button"
                onClick={handleSendSignupOtp}
                disabled={otpSending}
                className="shrink-0 px-3 rounded-xl bg-white/10 border border-purple-500/40 text-xs font-semibold text-purple-200 hover:bg-purple-500/20 disabled:opacity-50"
              >
                {otpSending ? "…" : "Send code"}
              </button>
            </div>
          </div>

          <Input label="Verification code (6 digits)" value={otp} setValue={setOtp} />
          <Input label="Phone Number" value={number} setValue={setNumber} />
          <Input label="Password" value={password} setValue={setPassword} type="password" />
          <Input label="Referral Code (optional)" value={referral} setValue={setReferral} />

          <PrimaryButton
            type="button"
            onClick={handleSignup}
            loading={loading}
            className="mt-4 font-semibold hover:shadow-xl"
          >
            Signup 🚀
          </PrimaryButton>

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
        alt="HybridEarn"
        width={36}
        height={36}
        className="rounded-full shadow-[0_0_20px_rgba(168,85,247,0.8)]"
      />
      <h1 className="font-bold text-lg bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
        HybridEarn
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