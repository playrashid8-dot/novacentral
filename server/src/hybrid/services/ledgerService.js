import HybridLedger from "../models/HybridLedger.js";

export const addHybridLedgerEntries = async (entries, session = null) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  return HybridLedger.create(entries, session ? { session } : undefined);
};
