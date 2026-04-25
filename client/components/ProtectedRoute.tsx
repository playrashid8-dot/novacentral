"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuth } from "../lib/auth";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      if (!isAuth()) {
        router.replace("/login");
      } else {
        setChecking(false);
      }
    };

    checkAuth();
  }, []);

  // 🔄 LOADING SCREEN
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}