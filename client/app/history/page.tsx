"use client";

import { useEffect, useState } from "react";
import API from "../../lib/api";
import { getUser } from "../../lib/auth";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function History() {
  const router = useRouter();

  const [data, setData]: any = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getUser();
    if (!u) return router.replace("/login");

    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await API.get("/history");
      setData(res.data);
    } catch {
      alert("Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-[420px] mx-auto px-4 py-6 text-white bg-[#040406]">

      <h1 className="text-xl font-bold mb-5 text-center">
        Transaction History 📜
      </h1>

      <div className="space-y-3">

        {data.length === 0 && (
          <p className="text-center text-gray-400 text-sm">
            No transactions yet
          </p>
        )}

        {data.map((tx: any, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white/5 p-4 rounded-xl border border-white/10"
          >

            <div className="flex justify-between">
              <p className="text-sm capitalize">
                {tx.type}
              </p>

              <p className="text-xs text-gray-400">
                {new Date(tx.createdAt).toLocaleDateString()}
              </p>
            </div>

            <h3 className="text-lg font-bold mt-1 text-green-400">
              ${tx.amount}
            </h3>

            <p className="text-xs text-gray-400 mt-1">
              Status: {tx.status}
            </p>

          </motion.div>
        ))}

      </div>

    </div>
  );
}