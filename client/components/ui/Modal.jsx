"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function Modal({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0f1629] p-6 shadow-[0_-20px_60px_rgba(0,0,0,0.5)] sm:rounded-3xl sm:shadow-2xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
        {title ? <h2 className="text-lg font-bold text-white">{title}</h2> : null}
        <div className={title ? "mt-4" : ""}>{children}</div>
        {footer ? <div className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-4">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
