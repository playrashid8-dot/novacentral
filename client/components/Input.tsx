"use client";

export default function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: any) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="input"
    />
  );
}