"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchCurrentUser } from "../../lib/session";
import { showSafeToast } from "../../lib/toast";
import Loader from "./Loader";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

let adminCsrfToken = null;

const ensureAdminCsrf = async () => {
  if (adminCsrfToken) return adminCsrfToken;
  const r = await fetch(`${API_BASE}/csrf-token`, { credentials: "include" });
  const payload = await r.json().catch(() => ({}));
  adminCsrfToken = payload?.data?.csrfToken || null;
  return adminCsrfToken;
};

export async function adminFetch(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = { ...(options.headers || {}) };
  delete headers.Authorization;
  delete headers.authorization;

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && !String(path).includes("csrf-token")) {
    const token = await ensureAdminCsrf();
    if (token) {
      headers["CSRF-Token"] = token;
      headers["csrf-token"] = token;
    }
  }

  const doFetch = () =>
    fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });

  let response = await doFetch();

  if (response.status === 403) {
    adminCsrfToken = null;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && !String(path).includes("csrf-token")) {
      const token = await ensureAdminCsrf();
      if (token) {
        headers["CSRF-Token"] = token;
        headers["csrf-token"] = token;
      }
      response = await doFetch();
    }
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok || payload?.success === false) {
    const error = new Error(
      payload?.msg || payload?.message || "Unable to complete request"
    );
    error.status = response.status;
    throw error;
  }

  return payload;
}

const navItems = [
  { label: "Overview", href: "/admin" },
  { label: "Analytics", href: "/admin/dashboard" },
  { label: "Deposits", href: "/admin/deposits" },
  { label: "Withdrawals", href: "/admin/withdrawals" },
  { label: "Users", href: "/admin/users" },
  { label: "Activity log", href: "/admin/logs" },
  { label: "Ledger", href: "/admin/ledger" },
];

export function formatCurrency(value) {
  const amount = Number(value || 0);
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString();
}

export function getUserLabel(user) {
  if (!user) return "Unknown";
  return user.username || user.email || user._id || "Unknown";
}

export default function AdminLayout({ title, subtitle, children }) {
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [accessDenied, setAccessDenied] = useState("");

  useEffect(() => {
    let active = true;

    const verifyAdmin = async () => {
      try {
        const user = await fetchCurrentUser();
        if (!user?.isAdmin) {
          if (active) {
            setAccessDenied("Access denied");
          }
          return;
        }
        await adminFetch("/admin/stats");
        if (active) setAccessDenied("");
      } catch (error) {
        if (active) {
          const msg = error?.message || "Access Denied";
          setAccessDenied(msg);
          showSafeToast(msg);
        }
      } finally {
        if (active) setChecking(false);
      }
    };

    verifyAdmin();

    return () => {
      active = false;
    };
  }, []);

  if (checking) {
    return (
      <AdminShell>
        <Loader label="Checking admin access..." />
      </AdminShell>
    );
  }

  if (accessDenied) {
    return (
      <AdminShell>
        <div className="mx-auto mt-20 max-w-md rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center">
          <h1 className="text-2xl font-bold text-white">Access Denied</h1>
          <p className="mt-3 text-sm text-red-100">
            {accessDenied}
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
          >
            Back to dashboard
          </Link>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-purple-300">HybridEarn Admin</p>
          <h1 className="mt-1 text-3xl font-bold text-white">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-gray-400">{subtitle}</p> : null}
        </div>
        <Link
          href="/dashboard"
          className="w-fit rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/10"
        >
          Back to app
        </Link>
      </header>

      <nav className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href === "/admin" && (pathname === "/admin" || pathname === "/admin/"));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm transition ${
                active
                  ? "bg-purple-600 text-white"
                  : "border border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </AdminShell>
  );
}

function AdminShell({ children }) {
  return (
    <section className="relative left-1/2 min-h-screen w-screen -translate-x-1/2 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}
