"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import API from "../../lib/api";
import { getUser, logout } from "../../lib/auth";
import BottomNav from "../../components/BottomNav";

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser]: any = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getUser();

    if (!u) {
      router.push("/login");
      return;
    }

    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const res = await API.get("/user/me");
      setUser(res.data.user);
    } catch (err) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pb-28 text-white glow-bg">

      <div className="flex justify-between items-center pt-5">
        <h1 className="text-xl font-bold text-glow">
          NovaCentral
        </h1>

        <button onClick={logout} className="text-red-400 text-sm">
          Logout
        </button>
      </div>

      <div className="mt-6 glow-card">
        <p className="text-gray-400 text-sm">Total Balance</p>

        <h1 className="text-4xl font-bold mt-2 text-green-400">
          ${Number(user?.balance || 0).toFixed(2)}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-6">

        <Stat title="Earnings" value={user?.totalEarnings} />
        <Stat title="Today" value={user?.todayProfit} />
        <Stat title="Invested" value={user?.totalInvested} />
        <Stat title="Withdrawn" value={user?.totalWithdraw} />

      </div>

      <BottomNav />
    </div>
  );
}

function Stat({ title, value }: any) {
  return (
    <div className="card">
      <p className="text-xs text-gray-400">{title}</p>
      <h4 className="font-bold text-lg text-cyan-400">
        ${Number(value || 0).toFixed(2)}
      </h4>
    </div>
  );
}