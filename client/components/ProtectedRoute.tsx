"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdmin, isAuth } from "../lib/auth";
import { motion } from "framer-motion";

export default function ProtectedRoute({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const verifyAuth = async () => {
      try {
        const ok = await isAuth();

        if (!mounted) return;

        const admin = isAdmin();

        // #region agent log
        fetch('http://127.0.0.1:7530/ingest/4afefbe1-47e6-4222-af48-f1c6fffa8a8e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f312c4'},body:JSON.stringify({sessionId:'f312c4',runId:'initial',hypothesisId:'H1,H2',location:'client/components/ProtectedRoute.tsx:31',message:'ProtectedRoute auth decision inputs',data:{ok,adminOnly,admin,checkingBefore:checking,redirectingBefore:redirecting},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        if (!ok) {
          // #region agent log
          fetch('http://127.0.0.1:7530/ingest/4afefbe1-47e6-4222-af48-f1c6fffa8a8e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f312c4'},body:JSON.stringify({sessionId:'f312c4',runId:'initial',hypothesisId:'H2',location:'client/components/ProtectedRoute.tsx:35',message:'ProtectedRoute unauth redirect branch',data:{checkingWillRemainTrue:true,redirectTo:'/login'},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          setRedirecting(true);
          router.replace("/login");
        } else if (adminOnly && !admin) {
          // #region agent log
          fetch('http://127.0.0.1:7530/ingest/4afefbe1-47e6-4222-af48-f1c6fffa8a8e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f312c4'},body:JSON.stringify({sessionId:'f312c4',runId:'initial',hypothesisId:'H1',location:'client/components/ProtectedRoute.tsx:41',message:'ProtectedRoute non-admin redirect branch',data:{checkingWillRemainTrue:true,redirectTo:'/dashboard'},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          setRedirecting(true);
          router.replace("/dashboard");
        } else {
          setChecking(false);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        setRedirecting(true);
        router.replace("/login");
      }
    };

    verifyAuth();

    return () => {
      mounted = false;
    };
  }, [adminOnly, router]);

  // 🔥 PREMIUM LOADER
  if (checking || redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#040406] text-white">

        {/* 🌌 BACKGROUND GLOW */}
        <div className="absolute w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[150px] top-[-150px] left-[-150px]" />
        <div className="absolute w-[500px] h-[500px] bg-indigo-600 opacity-20 blur-[150px] bottom-[-150px] right-[-150px]" />

        {/* LOADER */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />

          <p className="text-sm text-gray-400">
            Checking authentication...
          </p>
        </motion.div>
      </div>
    );
  }

  // ✅ AUTHORIZED
  return <>{children}</>;
}