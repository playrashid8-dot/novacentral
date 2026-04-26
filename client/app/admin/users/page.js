"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLayout, {
  adminFetch,
  formatCurrency,
} from "../../../components/admin/AdminLayout";
import Loader from "../../../components/admin/Loader";
import Table from "../../../components/admin/Table";

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadUsers = async () => {
      try {
        setLoading(true);
        setError("");
        const payload = await adminFetch("/admin/users");
        const nextUsers = payload?.data?.users || payload?.users || [];
        if (active) setUsers(nextUsers);
      } catch (err) {
        if (active) setError(err.message || "Failed to load users");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadUsers();

    return () => {
      active = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        user.username?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query);
      const status = user.isBlocked ? "blocked" : "active";
      const matchesStatus = statusFilter === "all" || statusFilter === status;

      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter, users]);

  return (
    <AdminLayout
      title="Users"
      subtitle="Track user balances, VIP levels, and account status."
    >
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px]">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by username or email"
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-purple-500"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-xl border border-white/10 bg-[#0b0b0f] px-4 py-3 text-sm text-white outline-none focus:border-purple-500"
        >
          <option value="all">All users</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      <StatusMessage type="error" message={error} />

      {loading ? (
        <Loader label="Loading users..." />
      ) : (
        <Table
          columns={["Username", "Balance", "VIP", "Status"]}
          emptyText="No users found"
        >
          {filteredUsers.map((user) => (
            <tr key={user._id} className="hover:bg-white/[0.03]">
              <td className="whitespace-nowrap px-4 py-4">
                <div className="font-medium text-white">{user.username || "-"}</div>
                <div className="text-xs text-gray-500">{user.email || "-"}</div>
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-green-300">
                {formatCurrency(user.balance)}
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-gray-300">
                VIP {Number(user.vipLevel || 0)}
              </td>
              <td className="whitespace-nowrap px-4 py-4">
                <span
                  className={`rounded-full px-3 py-1 text-xs ${
                    user.isBlocked
                      ? "bg-red-500/15 text-red-300"
                      : "bg-green-500/15 text-green-300"
                  }`}
                >
                  {user.isBlocked ? "Blocked" : "Active"}
                </span>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </AdminLayout>
  );
}

function StatusMessage({ type = "success", message }) {
  if (!message) return null;

  const styles =
    type === "error"
      ? "border-red-500/20 bg-red-500/10 text-red-100"
      : "border-green-500/20 bg-green-500/10 text-green-100";

  return <div className={`mb-4 rounded-xl border p-3 text-sm ${styles}`}>{message}</div>;
}
