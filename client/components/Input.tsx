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
        <p className="text-xs text-gray-400 mb-1">{label}</p>
      )}

      <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3">

        {icon && <span className="mr-2 text-gray-400">{icon}</span>}

        <input
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder || label}
          className="w-full bg-transparent py-3 outline-none text-sm"
        />

        {/* 👁 PASSWORD TOGGLE */}
        {passwordToggle && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="text-xs text-gray-400"
          >
            {show ? "Hide" : "Show"}
          </button>
        )}

      </div>
    </div>
  );
}