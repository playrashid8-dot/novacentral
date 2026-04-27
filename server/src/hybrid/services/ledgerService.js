import HybridLedger from "../models/HybridLedger.js";

export const addHybridLedgerEntries = async (entries, session = null) => {
  try {
    if (!Array.isArray(entries) || entries.length === 0) {
      return [];
    }

    return HybridLedger.insertMany(entries, {
      ordered: true,
      ...(session ? { session } : {}),
    });
  } catch (error) {
    throw new Error(error.message || "Failed to write ledger entries");
  }
};
