"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import API from "../../lib/api";
import { logout } from "../../lib/auth";
import BottomNav from "../../components/BottomNav";
import ProtectedRoute from "../../components/ProtectedRoute";

export default function History() {
  const router = useRouter();

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await API.get("/history");
      setData(res.data.history || []);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  return (
    <ProtectedRoute>
    <div className="min-h-screen max-w-[420px] mx-auto px-4 pb-28 text-white">

      {/* HEADER */}
      <div className="flex justify-between items-center pt-5">
        <h1 className="text-xl font-bold text-purple-400">📜 History</h1>

        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-gray-400"
        >
          Back
        </button>
      </div>

      {/* LIST */}
      <div className="mt-5 space-y-3">

        {data.length === 0 && (
          <p className="text-center text-gray-500 mt-10">
            No transactions yet
          </p>
        )}

        {data.map((item, i) => (
          <div
            key={i}
            className="bg-white/5 border border-white/10 p-4 rounded-xl"
          >
            <div className="flex justify-between items-center">

              {/* TYPE */}
              <span className={`text-sm font-semibold ${getTypeColor(item.type)}`}>
                {item.type.toUpperCase()}
              </span>

              {/* STATUS */}
              <span className={`text-xs ${getStatusColor(item.status)}`}>
                {item.status}
              </span>
            </div>

            {/* AMOUNT */}
            <p className="text-lg font-bold mt-1 text-green-400">
              ${Number(item.amount).toFixed(2)}
            </p>

            {/* DATE */}
            <p className="text-xs text-gray-500 mt-1">
              {new Date(item.createdAt).toLocaleString()}
            </p>
          </div>
        ))}

      </div>

      <BottomNav />
    </div>
    </ProtectedRoute>
  );
}

/* 🎨 TYPE COLOR */
function getTypeColor(type: string) {
  switch (type) {
    case "deposit":
      return "text-green-400";
    case "withdraw":
      return "text-red-400";
    case "investment":
      return "text-blue-400";
    default:
      return "text-gray-400";
  }
}

/* 🎨 STATUS COLOR */
function getStatusColor(status: string) {
  switch (status) {
    case "approved":
    case "success":
      return "text-green-400";
    case "pending":
      return "text-yellow-400";
    case "rejected":
      return "text-red-400";
    default:
      return "text-gray-400";
  }
}