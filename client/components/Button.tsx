"use client";

export default function Button({
  children,
  onClick,
  className = "",
}: any) {
  return (
    <button
      onClick={onClick}
      className={`btn ${className}`}
    >
      {children}
    </button>
  );
}