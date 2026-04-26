"use client";

import { useEffect, useState } from "react";
import AdminLayout, {
  adminFetch,
  formatCurrency,
  getUserLabel,
} from "../../../components/admin/AdminLayout";
import Loader from "../../../components/admin/Loader";
import Table from "../../../components/admin/Table";

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState("");

  const loadWithdrawals = async () => {
    try {
      setLoading(true);
      setError("");
      const payload = await adminFetch("/admin/withdrawals");
      setWithdrawals(payload?.data?.withdrawals || payload?.withdrawals || []);
    } catch (err) {
      setError(err.message || "Failed to load withdrawals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const runAction = async (id, action) => {
    if (processingId) return;

    try {
      setProcessingId(`${action}:${id}`);
      setMessage("");
      setError("");
      const payload = await adminFetch(`/admin/${action}-withdrawal/${id}`, {
        method: "POST",
      });
      const completed = action === "approve" ? "approved" : "rejected";
      setMessage(payload?.msg || `Withdrawal ${completed} successfully`);
      await loadWithdrawals();
    } catch (err) {
      setError(err.message || `Failed to ${action} withdrawal`);
    } finally {
      setProcessingId("");
    }
  };

  return (
    <AdminLayout
      title="Withdrawals"
      subtitle="Approve or reject withdrawal requests from users."
    >
      <StatusMessage message={message} />
      <StatusMessage type="error" message={error} />

      {loading ? (
        <Loader label="Loading withdrawals..." />
      ) : (
        <Table
          columns={["User", "Amount", "Wallet", "Status", "Actions"]}
          emptyText="No withdrawals found"
        >
          {withdrawals.map((withdrawal) => {
            const isPending = withdrawal.status === "pending";
            const approving = processingId === `approve:${withdrawal._id}`;
            const rejecting = processingId === `reject:${withdrawal._id}`;

            return (
              <tr key={withdrawal._id} className="hover:bg-white/[0.03]">
                <td className="whitespace-nowrap px-4 py-4">
                  <div className="font-medium text-white">
                    {getUserLabel(withdrawal.userId)}
                  </div>
                  {withdrawal.userId?.email ? (
                    <div className="text-xs text-gray-500">
                      {withdrawal.userId.email}
                    </div>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-green-300">
                  {formatCurrency(withdrawal.amount)}
                </td>
                <td className="max-w-[260px] px-4 py-4">
                  <span className="block truncate text-gray-300">
                    {withdrawal.walletAddress || "-"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <StatusBadge status={withdrawal.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => runAction(withdrawal._id, "approve")}
                      disabled={!isPending || Boolean(processingId)}
                      className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {approving ? "Approving..." : "Approve"}
                    </button>
                    <button
                      onClick={() => runAction(withdrawal._id, "reject")}
                      disabled={!isPending || Boolean(processingId)}
                      className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {rejecting ? "Rejecting..." : "Reject"}
                    </button>
                  </div>
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
