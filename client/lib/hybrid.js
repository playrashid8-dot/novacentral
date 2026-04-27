import API from "./api";

export const fetchHybridSummary = async () => {
  const res = await API.get("/hybrid/deposit/summary");
  return res.data?.data || null;
};

export const claimHybridRoi = async () => {
  const res = await API.post("/roi/claim");
  return res.data?.data || null;
};

export const fetchHybridWithdrawals = async () => {
  const res = await API.get("/withdraw/my");
  return res.data?.data?.withdrawals || [];
};

export const requestHybridWithdraw = async (payload, idempotencyKey) => {
  const res = await API.post("/withdraw/request", payload, {
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });

  return res.data?.data || null;
};

export const claimHybridWithdraw = async (withdrawalId) => {
  const res = await API.post("/withdraw/claim", { withdrawalId });
  return res.data?.data || null;
};
