import API from "./api";

export const fetchHybridSummary = async () => {
  const res = await API.get("/hybrid/deposit/summary");
  return res.data?.data || null;
};

export const claimHybridRoi = async () => {
  const res = await API.post("/roi/claim");
  return res.data?.data || null;
};

export const claimHybridSalary = async () => {
  const res = await API.post("/salary/claim");
  return res.data?.data || null;
};

export const fetchHybridWithdrawals = async () => {
  const res = await API.get("/withdraw/my");
  return res.data?.data?.withdrawals || [];
};

/** Sends OTP to the logged-in user's email (hybrid withdraw). */
export const sendWithdrawalOtp = async () => {
  const res = await API.post("/withdraw/send-otp", {});
  return res.data;
};

export const fetchHybridStakes = async () => {
  const res = await API.get("/stake/my");
  return res.data?.data?.stakes || [];
};

export const createHybridStake = async (payload) => {
  const res = await API.post("/stake/create", payload);
  return res.data?.data || null;
};

export const claimHybridStake = async (stakeId) => {
  const res = await API.post("/stake/claim", { stakeId });
  return res.data?.data || null;
};

export const requestHybridWithdraw = async (payload, idempotencyKey) => {
  const res = await API.post(
    "/withdraw/request",
    {
      amount: payload.amount,
      walletAddress: payload.walletAddress,
      password: payload.password,
      otp: payload.otp,
    },
    {
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    }
  );

  return res.data?.data || null;
};

export const claimHybridWithdraw = async (withdrawalId) => {
  const res = await API.post("/withdraw/claim", { withdrawalId });
  return res.data?.data || null;
};
