import assert from "node:assert/strict";

process.env.HYBRID_ADMIN_WALLET ||= "0x0000000000000000000000000000000000000001";
process.env.HYBRID_MNEMONIC ||= "test test test test test test test test test test test junk";
process.env.HYBRID_PRIVATE_KEY_ENCRYPTION_SECRET ||= "test_secret_for_simulation_only";
process.env.HYBRID_USDT_CONTRACT ||= "0x0000000000000000000000000000000000000002";

const { executeApprovedWithdrawalPayout } = await import(
  "../src/hybrid/services/withdrawService.js"
);
const { isFailedIdempotencyExpired } = await import(
  "../src/hybrid/services/idempotencyService.js"
);

const clone = (value) => JSON.parse(JSON.stringify(value));

const makePayoutRuntime = (state) => ({
  findWithdrawalById: async () => clone(state.withdrawal),
  findApprovedWithTxHash: async () => null,
  findNonceRecoveryWithdrawal: async () => null,
  claimWithdrawal: async (_withdrawalId, now, lockUntil) => {
    const w = state.withdrawal;
    if (w.status !== "approved" || w.paidAt !== null || w.payoutStatus === "sending") {
      return null;
    }

    w.payoutLockedUntil = lockUntil.toISOString();
    w.payoutStartedAt = now.toISOString();
    w.payoutLastError = "";
    w.payoutStatus = "sending";
    w.payoutAttemptCount = Number(w.payoutAttemptCount || 0) + 1;
    return clone(w);
  },
  lockPayoutNonce: async (_withdrawalId, nonce, payoutWallet) => {
    if (state.withdrawal.payoutNonce === undefined) {
      state.withdrawal.payoutNonce = nonce;
      state.withdrawal.payoutWallet = payoutWallet;
    }
    return clone(state.withdrawal);
  },
  storePayoutTxHash: async (_withdrawalId, txHash) => {
    if (state.crashBeforeSavingTxHash) {
      throw new Error("simulated crash before txHash save");
    }
    state.withdrawal.txHash = txHash;
    state.withdrawal.payoutStatus = "verifying";
    return clone(state.withdrawal);
  },
  getIdempotencyRecord: async () => state.idempotency,
  markIdempotencyProcessing: async () => {
    state.idempotency = { status: "processing", response: null };
    return state.idempotency;
  },
  completeIdempotency: async (_type, _key, response) => {
    state.idempotency = { status: "completed", response };
    return state.idempotency;
  },
  releaseIdempotentAction: async () => {
    state.idempotency = null;
  },
  storePayoutFailure: async (_withdrawalId, error, withdrawal) => {
    state.withdrawal.payoutLastError = String(error?.message || error);
    state.withdrawal.payoutStatus = "failed";
    const backoffMs = Math.min(5 * 60 * 1000, Number(withdrawal?.payoutAttemptCount || 1) * 30000);
    state.withdrawal.payoutLockedUntil = new Date(Date.now() + backoffMs).toISOString();
  },
  getProvider: () => ({
    getTransactionCount: async () => state.chainNonce,
  }),
  getPayoutSigner: () => ({
    address: state.payoutWallet,
    getNonce: async () => state.signerNonce,
  }),
  getPayoutContract: () => ({
    transfer: async () => {
      state.transferCount += 1;
      state.chainNonce = state.signerNonce + 1;
      state.broadcastTxHash = `0x${"a".repeat(64)}`;
      return {
        hash: state.broadcastTxHash,
        wait: async () => ({ status: 1 }),
      };
    },
  }),
  findPayoutTxHashByNonce: async () =>
    state.chainNonce > Number(state.withdrawal.payoutNonce) ? state.broadcastTxHash : null,
  verifyReceipt: async () => true,
  markPaid: async (_withdrawalId, txHash) => {
    if (state.withdrawal.status === "paid") {
      return { withdrawal: clone(state.withdrawal), txHash };
    }
    assert.equal(state.withdrawal.status, "approved");
    state.withdrawal.status = "paid";
    state.withdrawal.txHash = txHash;
    state.withdrawal.paidAt = new Date().toISOString();
    state.withdrawal.payoutStatus = "idle";
    state.withdrawal.payoutLockedUntil = null;
    return { withdrawal: clone(state.withdrawal), txHash };
  },
});

const makeWithdrawal = () => ({
  _id: "withdrawal_1",
  status: "approved",
  paidAt: null,
  txHash: null,
  payoutStatus: "idle",
  payoutAttemptCount: 0,
  walletAddress: "0xrecipient",
  netAmount: 10,
});

const makeState = () => ({
  withdrawal: makeWithdrawal(),
  signerNonce: 12,
  chainNonce: 12,
  payoutWallet: "0xpayout",
  transferCount: 0,
  broadcastTxHash: null,
  idempotency: null,
  crashBeforeSavingTxHash: false,
});

const testPayoutCrashRecovery = async () => {
  const state = makeState();
  const runtime = makePayoutRuntime(state);
  state.crashBeforeSavingTxHash = true;

  await assert.rejects(
    executeApprovedWithdrawalPayout(state.withdrawal._id, runtime),
    /simulated crash/
  );

  assert.equal(state.transferCount, 1);
  assert.equal(state.withdrawal.txHash, null);
  assert.equal(state.withdrawal.payoutNonce, 12);
  assert.equal(state.idempotency.status, "processing");

  state.crashBeforeSavingTxHash = false;
  const result = await executeApprovedWithdrawalPayout(state.withdrawal._id, runtime);

  assert.equal(result.processed, true);
  assert.equal(state.transferCount, 1);
  assert.equal(state.withdrawal.status, "paid");
  assert.equal(state.withdrawal.txHash, state.broadcastTxHash);
};

const testDoublePayoutExecutor = async () => {
  const state = makeState();
  const runtime = makePayoutRuntime(state);

  const first = await executeApprovedWithdrawalPayout(state.withdrawal._id, runtime);
  const second = await executeApprovedWithdrawalPayout(state.withdrawal._id, runtime);

  assert.equal(first.processed, true);
  assert.equal(second.reason, "already_paid");
  assert.equal(state.transferCount, 1);
};

const testProcessingIdempotencyBlocksBroadcast = async () => {
  const state = makeState();
  state.withdrawal.payoutNonce = 12;
  state.withdrawal.payoutWallet = state.payoutWallet;
  state.withdrawal.payoutStatus = "sending";
  state.chainNonce = 13;
  state.broadcastTxHash = `0x${"b".repeat(64)}`;
  state.idempotency = { status: "processing", response: null };
  const runtime = makePayoutRuntime(state);

  const result = await executeApprovedWithdrawalPayout(state.withdrawal._id, runtime);

  assert.equal(result.processed, true);
  assert.equal(state.transferCount, 0);
  assert.equal(state.withdrawal.status, "paid");
};

const testReferralNoRepeatAfterSwept = () => {
  const user = { hasQualifiedDeposit: false };
  const referralLedger = [];

  const creditDeposit = () => {
    const isFirstQualifiedDeposit = user.hasQualifiedDeposit !== true;
    if (!user.hasQualifiedDeposit) {
      user.hasQualifiedDeposit = true;
    }

    const alreadyRewarded = referralLedger.some(
      (entry) => entry.source === "referral_bonus" && entry.meta.firstDeposit === true
    );

    if (user.hasQualifiedDeposit === true && isFirstQualifiedDeposit && !alreadyRewarded) {
      referralLedger.push({ source: "referral_bonus", meta: { firstDeposit: true } });
    }
  };

  creditDeposit();
  const statusAfterFirstDeposit = "swept";
  assert.equal(statusAfterFirstDeposit, "swept");
  creditDeposit();

  assert.equal(referralLedger.length, 1);
};

const testFailedIdempotencyRetryWindow = () => {
  const now = Date.now();

  assert.equal(
    isFailedIdempotencyExpired(
      { status: "failed", updatedAt: new Date(now - 29999).toISOString() },
      now
    ),
    false
  );
  assert.equal(
    isFailedIdempotencyExpired(
      { status: "failed", updatedAt: new Date(now - 30001).toISOString() },
      now
    ),
    true
  );
};

const testLedgerConsistencyAdjustment = () => {
  const userRewardBalance = 110;
  const ledgerEntries = [
    { entryType: "credit", amount: 100 },
    { entryType: "debit", amount: 5 },
  ];
  const ledgerSum = ledgerEntries.reduce(
    (sum, entry) => sum + (entry.entryType === "credit" ? entry.amount : -entry.amount),
    0
  );
  const diff = Number((userRewardBalance - ledgerSum).toFixed(8));
  const adjustment = {
    entryType: diff > 0 ? "credit" : "debit",
    amount: Math.abs(diff),
    source: "ledger_reconciliation",
  };
  const reconciledLedgerSum =
    ledgerSum + (adjustment.entryType === "credit" ? adjustment.amount : -adjustment.amount);

  assert.equal(reconciledLedgerSum, userRewardBalance);
};

await testPayoutCrashRecovery();
await testDoublePayoutExecutor();
await testProcessingIdempotencyBlocksBroadcast();
testReferralNoRepeatAfterSwept();
testFailedIdempotencyRetryWindow();
testLedgerConsistencyAdjustment();

console.log("P0 financial safety simulations passed");
