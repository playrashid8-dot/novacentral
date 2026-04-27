"use client";

import { useState } from "react";

export default function Input({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  icon,
  passwordToggle = false,
}: any) {
  const [show, setShow] = useState(false);

  const inputType =
    passwordToggle ? (show ? "text" : "password") : type;

  return (
    <div className="mb-4">

      {label && (
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400 mb-2">{label}</p>
      )}

      <div className="flex items-center bg-white/[0.06] border border-white/10 rounded-xl px-3 backdrop-blur-xl transition-all duration-300 focus-within:border-purple-400/80 focus-within:ring-2 focus-within:ring-purple-500/25 focus-within:shadow-[0_0_30px_rgba(124,58,237,0.32)]">

        {icon && <span className="mr-2 text-gray-400">{icon}</span>}

        <input
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder || label}
          className="w-full bg-transparent py-3 outline-none text-sm text-white placeholder:text-gray-600"
        />

        {/* 👁 PASSWORD TOGGLE */}
        {passwordToggle && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="text-xs text-purple-300 hover:text-white transition"
          >
            {show ? "Hide" : "Show"}
          </button>
        )}

      </div>
    </div>
  );
}