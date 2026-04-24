"use client";

import { useEffect, useState } from "react";
import API from "../../lib/api";

export default function Admin() {
  const [deposits, setDeposits] = useState([]);

  const fetchDeposits = async () => {
    const res = await API.get("/admin/deposits");
    setDeposits(res.data);
  };

  const approveDeposit = async (id: string) => {
    await API.post(`/admin/approve/${id}`);
    fetchDeposits();
  };

  useEffect(() => {
    fetchDeposits();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-5">

      <h1 className="text-xl font-bold mb-6">Admin Panel</h1>

      <div className="space-y-4">

        {deposits.map((d: any) => (
          <div
            key={d._id}
            className="p-4 bg-[#111827] rounded-xl border border-white/10"
          >
            <p>User: {d.userId?.email}</p>
            <p>Amount: ${d.amount}</p>
            <p>Status: {d.status}</p>

            {d.status === "pending" && (
              <button
                onClick={() => approveDeposit(d._id)}
                className="mt-2 bg-green-500 px-4 py-2 rounded-lg"
              >
                Approve
              </button>
            )}
          </div>
        ))}

      </div>

    </div>
  );
}