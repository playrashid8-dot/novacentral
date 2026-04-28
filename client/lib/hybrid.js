import API, { normalize } from "./api";

export const fetchHybridSummary = async () => {
  const res = await API.get("/hybrid/deposit/summary");
  const response = normalize(res.data);
  const data = response.data;
  return data && typeof data === "object" && Object.keys(data).length ? data : null;
};

export const claimHybridRoi = async () => {
  const res = await API.post("/roi/claim");
  const response = normalize(res.data);
  return response.data && Object.keys(response.data).length ? response.data : null;
};

export const claimHybridSalary = async () => {
  const res = await API.post("/salary/claim");
  const response = normalize(res.data);
  return response.data && Object.keys(response.data).length ? response.data : null;
};

export const fetchHybridWithdrawals = async () => {
  const res = await API.get("/withdraw/my");
  const response = normalize(res.data);
  return response.data?.withdrawals || [];
};

/** Sends OTP to the logged-in user's email (hybrid withdraw). */
export const sendWithdrawalOtp = async () => {
  const res = await API.post("/withdraw/send-otp", {});
  return normalize(res.data);
};

export const fetchHybridStakes = async () => {
  const res = await API.get("/stake/my");
  const response = normalize(res.data);
  return response.data?.stakes || [];
};

export const createHybridStake = async (payload) => {
  const res = await API.post("/stake/create", payload);
  const response = normalize(res.data);
  return response.data && Object.keys(response.data).length ? response.data : null;
};

export const claimHybridStake = async (stakeId) => {
  const res = await API.post("/stake/claim", { stakeId });
  const response = normalize(res.data);
  return response.data && Object.keys(response.data).length ? response.data : null;
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

  const response = normalize(res.data);
  return response.data && Object.keys(response.data).length ? response.data : null;
};

export const claimHybridWithdraw = async (withdrawalId) => {
  const res = await API.post("/withdraw/claim", { withdrawalId });
  const response = normalize(res.data);
  return response.data && Object.keys(response.data).length ? response.data : null;
};
