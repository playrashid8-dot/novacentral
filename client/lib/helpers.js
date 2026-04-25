// 💰 FORMAT USD
export const formatUSD = (num) => {
  return `$${Number(num || 0).toFixed(2)}`;
};

// 💎 FORMAT USDT
export const formatUSDT = (num) => {
  return `${Number(num || 0).toFixed(2)} USDT`;
};

// 🔢 SHORT NUMBER (25K+, 2.4M)
export const shortNumber = (num) => {
  const n = Number(num || 0);

  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M+";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K+";

  return n.toString();
};

// 📅 FORMAT DATE
export const formatDate = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleString();
};

// 📆 SIMPLE DATE (DD MMM)
export const formatShortDate = (date) => {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
  });
};

// ⏳ TIME AGO (2h ago)
export const timeAgo = (date) => {
  if (!date) return "-";

  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (let key in intervals) {
    const value = Math.floor(seconds / intervals[key]);
    if (value > 0) {
      return `${value} ${key}${value > 1 ? "s" : ""} ago`;
    }
  }

  return "Just now";
};

// 🔐 MASK WALLET (0x1234...abcd)
export const maskAddress = (addr) => {
  if (!addr) return "-";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

// 🔗 COPY TO CLIPBOARD
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

// 📊 CALCULATE ROI TOTAL
export const calculateROI = (amount, dailyROI, days) => {
  const total = (amount * dailyROI * days) / 100;
  return total;
};

// 💹 FINAL AMOUNT AFTER ROI
export const finalAmount = (amount, dailyROI, days) => {
  return Number(amount) + calculateROI(amount, dailyROI, days);
};

// 🎯 VALIDATE NUMBER INPUT
export const isValidNumber = (value) => {
  return !isNaN(value) && Number(value) > 0;
};

// 🧠 SAFE PARSE FLOAT
export const toNumber = (val) => {
  return Number(val || 0);
};

// 🎨 STATUS COLOR (UI use)
export const getStatusColor = (status) => {
  switch (status) {
    case "success":
      return "text-green-400";
    case "pending":
      return "text-yellow-400";
    case "failed":
      return "text-red-400";
    default:
      return "text-gray-400";
  }
};