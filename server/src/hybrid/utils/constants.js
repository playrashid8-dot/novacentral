export const HYBRID_BASE_PATH = "m/44'/60'/0'/0";

export const HYBRID_TOKEN = {
  symbol: "USDT",
  network: "BEP20",
  decimals: Number(process.env.HYBRID_USDT_DECIMALS || 18),
};

export const ROI_RATES = {
  0: 0,
  1: 0.01,
  2: 0.015,
  3: 0.02,
};

export const LEVEL_RULES = [
  { level: 1, minDeposit: 50, directCount: 0, teamCount: 0, bonus: 5 },
  { level: 2, minDeposit: 50, directCount: 5, teamCount: 15, bonus: 20 },
  { level: 3, minDeposit: 50, directCount: 18, teamCount: 45, bonus: 50 },
];

export const SALARY_RULES = [
  { stage: 1, directCount: 3, teamCount: 10, amount: 30 },
  { stage: 2, directCount: 6, teamCount: 20, amount: 80 },
  { stage: 3, directCount: 12, teamCount: 35, amount: 250 },
  { stage: 4, directCount: 18, teamCount: 45, amount: 500 },
];

export const REFERRAL_RATES = [
  { depth: 1, rate: 0.1 },
  { depth: 2, rate: 0.06 },
  { depth: 3, rate: 0.05 },
];

export const STAKE_PLANS = {
  7: { days: 7, dailyRate: 0.013 },
  15: { days: 15, dailyRate: 0.015 },
  30: { days: 30, dailyRate: 0.018 },
  60: { days: 60, dailyRate: 0.022 },
};

export const WITHDRAW_MIN_AMOUNT = 30;
export const WITHDRAW_FEE_RATE = 0.05;

export const WITHDRAW_MONTHLY_LIMITS = {
  0: 0,
  1: 500,
  2: 2000,
  3: 5000,
};

export const BSC_USDT_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];
