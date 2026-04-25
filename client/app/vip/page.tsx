"use client";

import { useEffect, useState } from "react";
import API from "../../lib/api";
import { getUser } from "../../lib/auth";

export default function Profile() {

  const [user, setUser]: any = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const res = await API.get("/user/me");
      setUser(res.data.user || res.data);
    } catch (err) {}
  };

  return (
    <div className="min-h-screen px-4 py-6 text-white">

      <h1 className="text-xl font-bold mb-5">👤 Profile</h1>

      <div className="card space-y-3">

        <p>Username: <b>{user?.username}</b></p>
        <p>Email: <b>{user?.email}</b></p>
        <p>Balance: <b>${user?.balance}</b></p>
        <p>Referral Code: <b>{user?.referralCode}</b></p>

      </div>

    </div>
  );
}