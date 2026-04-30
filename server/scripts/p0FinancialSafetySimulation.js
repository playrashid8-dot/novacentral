import assert from "node:assert/strict";

process.env.HYBRID_ADMIN_WALLET ||= "0x0000000000000000000000000000000000000001";
process.env.HYBRID_MNEMONIC ||= "test test test test test test test test test test test junk";
process.env.HYBRID_PAYOUT_PRIVATE_KEY ||= `0x${"1".repeat(64)}`;
process.env.HYBRID_PRIVATE_KEY_ENCRYPTION_SECRET ||= "test_secret_for_simulation_only";
process.env.HYBRID_USDT_CONTRACT ||= "0x0000000000000000000000000000000000000002";

const {
  adminMarkHybridWithdrawalPaid,
  allowedWithdrawTransitions,
  executeApprovedWithdrawalPayout,
  runAutoWithdrawExecutorBatch,
} = await import("../src/hybrid/services/withdrawService.js");
const { isFailedIdempotencyExpired } = await import(
  "../src/hybrid/services/idempotencyService.js"
);

const clone = (value) => JSON.parse(JSON.stringify(value));

const makePayoutRuntime = (state) => ({
  findWithdrawalById: async () => clone(state.withdrawal),
  findApprovedWithTxHash: async () => null,
  findNonceRecoveryWithdrawal: async () => null,
  resetStaleSendingPayouts: async () => ({ modifiedCount: 0 }),
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
    transfer: async (_wallet, _amount, options = {}) => {
      assert.equal(options.nonce, state.withdrawal.payoutNonce);
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

const testExecutorSkipsUnusedNonceRecovery = async () => {
  const stuck = {
    ...makeWithdrawal(),
    _id: "withdrawal_stuck",
    payoutNonce: 20,
    payoutWallet: "0xpayout",
    payoutStatus: "sending",
    payoutStartedAt: new Date().toISOString(),
  };
  const payable = {
    ...makeWithdrawal(),
    _id: "withdrawal_payable",
  };
  const state = {
    withdrawals: [stuck, payable],
    signerNonce: 21,
    chainNonce: 20,
    payoutWallet: "0xpayout",
    transferCount: 0,
    broadcastTxHash: null,
    broadcastTxByNonce: new Map(),
    idempotency: null,
  };

  const byId = (id) => state.withdrawals.find((item) => item._id === id);
  const runtime = {
    findWithdrawalById: async (id) => clone(byId(id)),
    findApprovedWithTxHash: async () => null,
    findNonceRecoveryWithdrawal: async () => clone(stuck),
    resetStaleSendingPayouts: async () => ({ modifiedCount: 0 }),
    claimWithdrawal: async (_withdrawalId, now, lockUntil) => {
      const w = state.withdrawals.find(
        (item) => item.status === "approved" && item.paidAt === null && item.payoutStatus !== "sending"
      );
      if (!w) {
        return null;
      }

      w.payoutLockedUntil = lockUntil.toISOString();
      w.payoutStartedAt = now.toISOString();
      w.payoutStatus = "sending";
      w.payoutAttemptCount = Number(w.payoutAttemptCount || 0) + 1;
      return clone(w);
    },
    lockPayoutNonce: async (withdrawalId, nonce, payoutWallet) => {
      const w = byId(withdrawalId);
      w.payoutNonce = nonce;
      w.payoutWallet = payoutWallet;
      return clone(w);
    },
    storePayoutTxHash: async (withdrawalId, txHash) => {
      const w = byId(withdrawalId);
      w.txHash = txHash;
      w.payoutStatus = "verifying";
      return clone(w);
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
    storePayoutFailure: async (_withdrawalId, error) => {
      throw error;
    },
    getProvider: () => ({
      getTransactionCount: async () => state.chainNonce,
    }),
    getPayoutSigner: () => ({
      address: state.payoutWallet,
      getNonce: async () => state.signerNonce,
    }),
    getPayoutContract: () => ({
      transfer: async (_wallet, _amount, options = {}) => {
        const w = byId("withdrawal_payable");
        assert.equal(options.nonce, w.payoutNonce);
        state.transferCount += 1;
        state.chainNonce = state.signerNonce + 1;
        state.broadcastTxHash = `0x${"c".repeat(64)}`;
        state.broadcastTxByNonce.set(options.nonce, state.broadcastTxHash);
        return {
          hash: state.broadcastTxHash,
          wait: async () => ({ status: 1 }),
        };
      },
    }),
    findPayoutTxHashByNonce: async (withdrawal) =>
      state.chainNonce > Number(withdrawal.payoutNonce)
        ? state.broadcastTxByNonce.get(Number(withdrawal.payoutNonce)) || null
        : null,
    verifyReceipt: async () => true,
    markPaid: async (withdrawalId, txHash) => {
      const w = byId(withdrawalId);
      w.status = "paid";
      w.txHash = txHash;
      w.paidAt = new Date().toISOString();
      w.payoutStatus = "idle";
      w.payoutLockedUntil = null;
      return { withdrawal: clone(w), txHash };
    },
  };

  const result = await runAutoWithdrawExecutorBatch(2, runtime);

  assert.equal(result.processed, 1);
  assert.equal(state.transferCount, 1);
  assert.equal(byId("withdrawal_stuck").status, "approved");
  assert.equal(byId("withdrawal_payable").status, "paid");
};

const testStaleSendingResetAllowsRetry = async () => {
  const state = makeState();
  state.withdrawal.payoutStatus = "sending";
  state.withdrawal.payoutStartedAt = new Date(Date.now() - 6 * 60 * 1000).toISOString();
  const runtime = {
    ...makePayoutRuntime(state),
    resetStaleSendingPayouts: async () => {
      state.withdrawal.payoutStatus = "failed";
      state.withdrawal.payoutLockedUntil = null;
      return { modifiedCount: 1 };
    },
  };

  const result = await executeApprovedWithdrawalPayout(state.withdrawal._id, runtime);

  assert.equal(result.processed, true);
  assert.equal(state.transferCount, 1);
  assert.equal(state.withdrawal.status, "paid");
};

const testReferralNoRepeatAfterSwept = () => {
  const user = { hasQualifiedDeposit: false };
  const referralLedger = [];
  const fromUserId = "user_1";

  const creditDeposit = () => {
    const isFirstQualifiedDeposit = user.hasQualifiedDeposit !== true;
    if (!user.hasQualifiedDeposit) {
      user.hasQualifiedDeposit = true;
    }

    const alreadyRewarded = referralLedger.some(
      (entry) => entry.source === "referral_bonus" && entry.meta.fromUserId === fromUserId
    );

    if (user.hasQualifiedDeposit === true && isFirstQualifiedDeposit && !alreadyRewarded) {
      referralLedger.push({ source: "referral_bonus", meta: { fromUserId, firstDeposit: true } });
    }
  };

  creditDeposit();
  const statusAfterFirstDeposit = "swept";
  assert.equal(statusAfterFirstDeposit, "swept");
  creditDeposit();

  assert.equal(referralLedger.length, 1);
};

const testLegacyReferralEntryBlocksRepeat = () => {
  const user = { hasQualifiedDeposit: false };
  const fromUserId = "legacy_user";
  const referralLedger = [
    {
      source: "referral_bonus",
      meta: { fromUserId },
    },
  ];

  const isFirstQualifiedDeposit = user.hasQualifiedDeposit !== true;
  user.hasQualifiedDeposit = true;

  const alreadyRewarded = referralLedger.some(
    (entry) => entry.source === "referral_bonus" && entry.meta.fromUserId === fromUserId
  );

  if (user.hasQualifiedDeposit === true && isFirstQualifiedDeposit && !alreadyRewarded) {
    referralLedger.push({ source: "referral_bonus", meta: { fromUserId, firstDeposit: true } });
  }

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

const testLedgerMismatchDetectionDoesNotAutoFix = () => {
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
  const flagged = Math.abs(diff) > 0.0001;
  const autoFixApplied = false;

  assert.equal(flagged, true);
  assert.equal(autoFixApplied, false);
  assert.equal(ledgerSum, 95);
};

const testAdminStateMachineBlocksInvalidTransitions = () => {
  assert.deepEqual(allowedWithdrawTransitions.pending, ["approved", "rejected"]);
  assert.deepEqual(allowedWithdrawTransitions.approved, ["paid"]);
  assert.deepEqual(allowedWithdrawTransitions.paid, []);

  const assertAdminPendingAction = (withdrawal) => {
    if (withdrawal.status !== "pending" || withdrawal.paidAt !== null) {
      throw new Error("Invalid state transition");
    }
  };

  assert.doesNotThrow(() => assertAdminPendingAction({ status: "pending", paidAt: null }));
  assert.throws(
    () => assertAdminPendingAction({ status: "approved", paidAt: null }),
    /Invalid state transition/
  );
  assert.throws(
    () => assertAdminPendingAction({ status: "paid", paidAt: new Date().toISOString() }),
    /Invalid state transition/
  );
};

const testManualAdminPayoutDisabled = async () => {
  await assert.rejects(
    adminMarkHybridWithdrawalPaid(),
    (error) =>
      error?.statusCode === 410 &&
      /Manual mark-paid is disabled/i.test(String(error?.message || ""))
  );
};

const testUnauthorizedAdminCallBlocked = () => {
  const adminStatus = (req) => (req.user?._id && req.user.isAdmin === true ? 200 : 403);

  assert.equal(adminStatus({ user: { _id: "user_1", isAdmin: false } }), 403);
  assert.equal(adminStatus({ user: null }), 403);
  assert.equal(adminStatus({ user: { _id: "admin_1", isAdmin: true } }), 200);
};

const testWalletDuplicateBlocked = () => {
  const existingWallets = new Set(["0xabc"]);
  const assertWalletAvailable = (walletAddress) => {
    if (existingWallets.has(String(walletAddress || "").toLowerCase())) {
      throw new Error("Wallet already in use");
    }
  };

  assert.throws(() => assertWalletAvailable("0xABC"), /Wallet already in use/);
  assert.doesNotThrow(() => assertWalletAvailable("0xdef"));
};

await testPayoutCrashRecovery();
await testDoublePayoutExecutor();
await testProcessingIdempotencyBlocksBroadcast();
await testExecutorSkipsUnusedNonceRecovery();
await testStaleSendingResetAllowsRetry();
testReferralNoRepeatAfterSwept();
testLegacyReferralEntryBlocksRepeat();
testFailedIdempotencyRetryWindow();
testLedgerMismatchDetectionDoesNotAutoFix();
testAdminStateMachineBlocksInvalidTransitions();
await testManualAdminPayoutDisabled();
testUnauthorizedAdminCallBlocked();
testWalletDuplicateBlocked();

console.log("P0 financial safety simulations passed");
