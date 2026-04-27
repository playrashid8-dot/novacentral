"use client";

import { useEffect, useState } from "react";
import AdminLayout, {
  adminFetch,
  formatCurrency,
  getUserLabel,
} from "../../../components/admin/AdminLayout";
import Loader from "../../../components/admin/Loader";
import Table from "../../../components/admin/Table";

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDeposits = async () => {
    try {
      setLoading(true);
      setError("");
      const payload = await adminFetch("/admin/deposits");
      setDeposits(payload?.data?.deposits || payload?.deposits || []);
    } catch (err) {
      setError(err.message || "Failed to load deposits");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeposits();
  }, []);

  return (
    <AdminLayout
      title="Hybrid deposits"
      subtitle="On-chain deposits detected by the hybrid listener (no manual approval)."
    >
      <StatusMessage type="error" message={error} />

      {loading ? (
        <Loader label="Loading deposits..." />
      ) : (
        <Table
          columns={["User", "Amount", "Tx", "Status"]}
          emptyText="No hybrid deposits found"
        >
          {deposits.map((deposit) => (
            <tr key={deposit._id} className="hover:bg-white/[0.03]">
              <td className="whitespace-nowrap px-4 py-4">
                <div className="font-medium text-white">
                  {getUserLabel(deposit.userId)}
                </div>
                {deposit.userId?.email ? (
                  <div className="text-xs text-gray-500">{deposit.userId.email}</div>
                ) : null}
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-green-300">
                {formatCurrency(deposit.amount)}
              </td>
              <td className="max-w-[200px] truncate px-4 py-4 font-mono text-xs text-gray-400">
                {deposit.txHash || "-"}
              </td>
              <td className="whitespace-nowrap px-4 py-4">
                <StatusBadge status={deposit.status} />
              </td>
            </tr>
          ))}
        </Table>
      )}
    </AdminLayout>
  );
}

function StatusBadge({ status }) {
  const normalized = status || "unknown";
  const color =
    normalized === "credited"
      ? "bg-green-500/15 text-green-300"
      : normalized === "failed"
        ? "bg-red-500/15 text-red-300"
        : normalized === "swept"
          ? "bg-blue-500/15 text-blue-200"
          : "bg-yellow-500/15 text-yellow-300";

  return (
    <span className={`rounded-full px-3 py-1 text-xs capitalize ${color}`}>
      {normalized}
    </span>
  );
}

function StatusMessage({ type = "error", message }) {
  if (!message) return null;

  const styles =
    type === "error"
      ? "border-red-500/20 bg-red-500/10 text-red-100"
      : "border-green-500/20 bg-green-500/10 text-green-100";

  return <div className={`mb-4 rounded-xl border p-3 text-sm ${styles}`}>{message}</div>;
}
