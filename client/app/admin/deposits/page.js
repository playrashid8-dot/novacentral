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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState("");

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

  const approveDeposit = async (id) => {
    if (processingId) return;

    try {
      setProcessingId(id);
      setMessage("");
      setError("");
      const payload = await adminFetch(`/admin/approve-deposit/${id}`, {
        method: "POST",
      });
      setMessage(payload?.msg || "Deposit approved successfully");
      await loadDeposits();
    } catch (err) {
      setError(err.message || "Failed to approve deposit");
    } finally {
      setProcessingId("");
    }
  };

  return (
    <AdminLayout
      title="Deposits"
      subtitle="Review deposit requests and approve pending transactions."
    >
      <StatusMessage message={message} />
      <StatusMessage type="error" message={error} />

      {loading ? (
        <Loader label="Loading deposits..." />
      ) : (
        <Table
          columns={["User", "Amount", "Status", "Action"]}
          emptyText="No deposits found"
        >
          {deposits.map((deposit) => {
            const isPending = deposit.status === "pending";
            const isProcessing = processingId === deposit._id;

            return (
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
                <td className="whitespace-nowrap px-4 py-4">
                  <StatusBadge status={deposit.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  {isPending ? (
                    <button
                      onClick={() => approveDeposit(deposit._id)}
                      disabled={Boolean(processingId)}
                      className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isProcessing ? "Approving..." : "Approve"}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-500">No action</span>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </AdminLayout>
  );
}

function StatusBadge({ status }) {
  const normalized = status || "unknown";
  const color =
    normalized === "approved"
      ? "bg-green-500/15 text-green-300"
      : normalized === "rejected"
        ? "bg-red-500/15 text-red-300"
        : "bg-yellow-500/15 text-yellow-300";

  return (
    <span className={`rounded-full px-3 py-1 text-xs capitalize ${color}`}>
      {normalized}
    </span>
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
