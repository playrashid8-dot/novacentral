"use client";

export default function SkeletonCard({ className = "" }) {
  return (
    <div
      className={`animate-pulse h-20 rounded-xl bg-gray-800/90 mb-3 shadow-inner ${className}`}
      aria-hidden
    />
  );
}
