"use client";

import { logout } from "../../lib/auth";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import ProtectedRoute from "../../components/ProtectedRoute";
import { fetchCurrentUser, updateUserPassword } from "../../lib/session";
import { fetchHybridSummary } from "../../lib/hybrid";
import GlassCard from "../../components/GlassCard";
import StatCard from "../../components/StatCard";
import PageWrapper from "../../components/PageWrapper";
import AppToast from "../../components/AppToast";
import { copyToClipboard, maskAddress } from "../../lib/helpers";
import { getApiErrorMessage } from "../../lib/api";

export default function Profile() {
  const router = useRouter();
  const [user, setUser]: any = useState(null);
  const [hybrid, setHybrid]: any = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  useEffect(() => {
    Promise.all([fetchCurrentUser(), fetchHybridSummary().catch(() => null)])
      .then(([fresh, hybridData]) => {
        if (fresh) setUser(fresh);
        if (hybridData) setHybrid(hybridData);
      })
      .finally(() => setLoading(false));
  }, []);

  const walletDisplayRaw = hybrid?.walletAddress || user?.walletAddress || "";
  const walletMasked = walletDisplayRaw ? maskAddress(walletDisplayRaw) : "—";

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const referralLink =
    user?.referralCode && origin
      ? `${origin}/signup?ref=${encodeURIComponent(user.referralCode)}`
      : "";

  const submitPassword = async () => {
    if (pwdBusy) return;
    const cur = currentPassword.trim();
    const neu = newPassword.trim();
    if (!cur || !neu) {
      showToast("Enter current and new password");
      return;
    }
    if (neu.length < 8) {
      showToast("New password must be at least 8 characters");
      return;
    }
    try {
      setPwdBusy(true);
      const res = await updateUserPassword(cur, neu);
      if (!res.success) {
        showToast(res.msg || "Could not update password");
        return;
      }
      showToast(res.msg || "Password updated");
      setCurrentPassword("");
      setNewPassword("");
    } catch (e: any) {
      showToast(getApiErrorMessage(e, "Password update failed"));
    } finally {
      setPwdBusy(false);
    }
  };

  const copyRef = async () => {
    if (!referralLink) return;
    const ok = await copyToClipboard(referralLink);
    showToast(ok ? "Referral link copied" : "Could not copy");
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <ProtectedRoute>
      <PageWrapper loading={loading} data={user?._id}>
        <div className="min-h-screen max-w-[420px] mx-auto px-4 py-6 pb-28 text-white relative bg-[#040406] overflow-x-hidden w-full">
          <AppToast message={toast} />

          <div className="absolute w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[150px] top-[-150px] left-[-150px]" />
          <div className="absolute w-[500px] h-[500px] bg-indigo-600 opacity-20 blur-[150px] bottom-[-150px] right-[-150px]" />

          <div className="flex justify-between items-center mb-6 relative z-10">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-purple-300/70">Account Center</p>
              <h1 className="text-2xl font-black bg-gradient-to-r from-purple-300 via-fuchsia-300 to-blue-300 bg-clip-text text-transparent">
                Profile
              </h1>
            </div>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="w-full max-w-[100px] shrink-0 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-purple-300 shadow-md transition hover:bg-purple-500/15 hover:shadow-lg sm:w-auto sm:max-w-none"
            >
              Back
            </button>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-[1px] rounded-3xl bg-gradient-to-r from-purple-500 via-fuchsia-500 to-indigo-500 shadow-[0_0_50px_rgba(124,58,237,0.32)]"
          >
            <div className="bg-[#0b0b0f]/95 p-5 rounded-3xl text-center backdrop-blur-2xl">
              <div className="flex justify-center mb-3">
                <div className="p-[2px] rounded-full bg-gradient-to-r from-purple-500 to-cyan-500">
                  <Image
                    src="/logo.png"
                    alt="user"
                    width={70}
                    height={70}
                    className="rounded-full bg-black"
                  />
                </div>
              </div>
              <h2 className="font-bold text-lg">{user?.username}</h2>
              <p className="text-xs text-gray-400">{user?.email}</p>
              <span className="mt-3 inline-flex rounded-full border border-purple-300/20 bg-purple-500/10 px-4 py-1 text-xs font-bold text-purple-100">
                VIP {Number(hybrid?.level || user?.level || 0)}
              </span>
              <p className="text-[11px] text-gray-500 mt-1">ID: {user?._id?.slice(0, 8)}…</p>
            </div>
          </motion.div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <StatCard title="Deposit" value={`$${Number(hybrid?.depositBalance ?? 0).toFixed(2)}`} tone="purple" />
            <StatCard title="Rewards" value={`$${Number(hybrid?.rewardBalance ?? 0).toFixed(2)}`} tone="cyan" />
          </div>

          <GlassCard glow="cyan" className="mt-5">
            <h3 className="text-sm font-semibold mb-3 text-gray-200">Account</h3>
            <div className="space-y-3 text-sm">
              <Info label="Username" value={user?.username || "-"} />
              <Info label="Email" value={user?.email || "-"} />
              <Info label="Platform wallet" value={walletMasked} />
              <Info label="Referral code" value={user?.referralCode || "—"} />
            </div>
          </GlassCard>

          <GlassCard glow="purple" className="mt-5">
            <h3 className="text-sm font-semibold mb-2 text-gray-200">Referral link</h3>
            <p className="text-[11px] text-gray-500 mb-3">Share this URL to register referrals under your account.</p>
            <p className="break-all rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[11px] text-purple-100">
              {referralLink || "—"}
            </p>
            <button
              type="button"
              onClick={copyRef}
              disabled={!referralLink}
              className="mt-3 w-full rounded-xl border border-purple-400/30 bg-purple-500/15 py-2.5 text-sm font-semibold text-purple-100 disabled:opacity-40"
            >
              {copiedLink ? "Copied" : "Copy referral link"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/team")}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.06] py-2.5 text-sm text-gray-200"
            >
              Team & salary milestones
            </button>
          </GlassCard>

          <GlassCard glow="gold" className="mt-5">
            <p className="text-[10px] uppercase tracking-[0.24em] text-yellow-200/80">Security</p>
            <h3 className="mt-1 text-lg font-black">Update password</h3>
            <p className="mt-2 text-xs text-gray-400">Session uses httpOnly cookies only.</p>
            <input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              disabled={pwdBusy}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.06] p-3 text-sm outline-none focus:border-yellow-400/40"
            />
            <input
              type="password"
              placeholder="New password (min 8 chars)"
              value={newPassword}
              disabled={pwdBusy}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.06] p-3 text-sm outline-none focus:border-yellow-400/40"
            />
            <button
              type="button"
              onClick={submitPassword}
              disabled={pwdBusy}
              className="mt-3 w-full rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 py-3 text-sm font-black text-black disabled:opacity-50"
            >
              {pwdBusy ? "Saving…" : "Save new password"}
            </button>
          </GlassCard>

          <button
            type="button"
            onClick={logout}
            className="mt-6 w-full rounded-xl bg-red-500/20 text-red-400 p-3 font-semibold hover:bg-red-500/30 transition shadow-md hover:shadow-lg"
          >
            Logout
          </button>
        </div>
      </PageWrapper>
    </ProtectedRoute>
  );
}

function Info({ label, value }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className="mt-1 break-all text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
