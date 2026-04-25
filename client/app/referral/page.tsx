"use client";

import { getUser } from "../../lib/auth";

export default function Referral() {
  const user = getUser();

  const link = `https://yourdomain.com/signup?ref=${user?._id}`;

  return (
    <div className="min-h-screen text-white p-5">
      <h1 className="text-xl font-bold mb-4">Referral</h1>

      <div className="card">
        <p className="text-sm mb-2">Your Referral Link:</p>
        <p className="text-xs break-all">{link}</p>
      </div>
    </div>
  );
}