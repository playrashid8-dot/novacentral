import { Contract, Wallet, isAddress, parseEther } from "ethers";
import hybridConfig from "../../config/hybridConfig.js";
import User from "../../models/User.js";
import HybridDeposit from "../models/HybridDeposit.js";
import { decryptPrivateKey } from "../utils/crypto.js";
import { BSC_USDT_ABI } from "../utils/constants.js";
import { getProvider, getRpcUrls } from "../utils/provider.js";

const MAX_SWEEP_BATCH = 10;
const SWEEP_DELAY_MS = 1500;
const MIN_BNB_WEI = parseEther("0.001");
const GAS_TOPUP_BUFFER = parseEther("0.00005");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const assertSweepConfig = () => {
  if (!hybridConfig.gasKey) {
    throw new Error("HYBRID_GAS_FUNDER_PRIVATE_KEY missing");
  }

  if (!hybridConfig.usdtContract) {
    throw new Error("HYBRID_USDT_CONTRACT missing");
  }
};

export const canSweepHybridFunds = () =>
  hybridConfig.earnEnabled &&
  hybridConfig.sweepEnabled &&
  !!hybridConfig.adminWallet &&
  !!hybridConfig.usdtContract &&
  !!hybridConfig.gasKey &&
  getRpcUrls().length > 0;

const clampBatchSize = (n) => {
  const raw = Number(n);
  if (!Number.isFinite(raw)) return 5;
  return Math.min(MAX_SWEEP_BATCH, Math.max(1, Math.floor(raw)));
};

export const getSweepBatchSize = () =>
  clampBatchSize(process.env.HYBRID_SWEEP_BATCH_SIZE ?? 5);

/**
 * Legacy helper — sends a fixed dust amount (used only if you call it explicitly).
 */
export const sendGas = async (address) => {
  try {
    assertSweepConfig();

    if (!isAddress(address)) {
      throw new Error("Valid recipient address is required");
    }

    const gasFunder = new Wallet(hybridConfig.gasKey, getProvider());
    const gasAmount = process.env.HYBRID_SWEEP_GAS_AMOUNT || "0.00006";
    const gasTx = await gasFunder.sendTransaction({
      to: address,
      value: parseEther(gasAmount),
    });

    const receipt = await gasTx.wait();

    return {
      txHash: String(receipt?.hash || gasTx.hash || "").toLowerCase(),
    };
  } catch (error) {
    throw new Error(`Failed to send sweep gas: ${error.message}`);
  }
};

export const ensureMinBnbForSweep = async (address) => {
  assertSweepConfig();

  if (!isAddress(address)) {
    throw new Error("Valid recipient address is required");
  }

  const provider = getProvider();
  const balance = await provider.getBalance(address);

  if (balance >= MIN_BNB_WEI) {
    return { toppedUp: false };
  }

  const gasFunder = new Wallet(hybridConfig.gasKey, provider);
  const shortfall = MIN_BNB_WEI - balance + GAS_TOPUP_BUFFER;
  const tx = await gasFunder.sendTransaction({ to: address, value: shortfall });
  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error("Gas top-up transaction failed");
  }

  const after = await provider.getBalance(address);
  if (after < MIN_BNB_WEI) {
    throw new Error("BNB still below minimum after top-up");
  }

  return { toppedUp: true, txHash: String(receipt.hash || "").toLowerCase() };
};

async function executeSweepForDeposit(depositStub) {
  const dep = await HybridDeposit.findById(depositStub._id);

  if (!dep || dep.status !== "credited" || dep.sweeped === true) {
    return { skipped: true, reason: "Not eligible for sweep" };
  }

  const user = await User.findById(dep.userId).select("+privateKey walletAddress");

  if (!user?.privateKey || !user?.walletAddress) {
    await HybridDeposit.findByIdAndUpdate(dep._id, {
      $set: { errorMessage: "User wallet credentials missing" },
    });
    throw new Error("User wallet credentials missing");
  }

  const userWalletLower = String(user.walletAddress).trim().toLowerCase();
  const depositWalletLower = String(dep.walletAddress).trim().toLowerCase();

  if (userWalletLower !== depositWalletLower) {
    await HybridDeposit.findByIdAndUpdate(dep._id, {
      $set: { errorMessage: "Wallet mismatch" },
    });
    throw new Error("User wallet does not match deposit wallet");
  }

  const provider = getProvider();
  const decrypted = decryptPrivateKey(user.privateKey);
  const signer = new Wallet(decrypted, provider);

  if (String(signer.address).toLowerCase() !== userWalletLower) {
    throw new Error("Derived wallet does not match stored address");
  }

  const tokenContract = new Contract(hybridConfig.usdtContract, BSC_USDT_ABI, signer);

  await ensureMinBnbForSweep(user.walletAddress);

  const bnbBalance = await provider.getBalance(user.walletAddress);
  if (bnbBalance < MIN_BNB_WEI) {
    throw new Error("BNB balance below 0.001 minimum for sweep");
  }

  const currentBalance = await tokenContract.balanceOf(user.walletAddress);

  if (currentBalance <= 0n) {
    return { skipped: true, reason: "No USDT balance to sweep" };
  }

  const sweepTx = await tokenContract.transfer(hybridConfig.adminWallet, currentBalance);
  const receipt = await sweepTx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error("Sweep transaction reverted or missing receipt");
  }

  const sweepTxHash = String(receipt.hash || sweepTx.hash || "").toLowerCase();

  const updated = await HybridDeposit.findOneAndUpdate(
    {
      _id: dep._id,
      status: "credited",
      sweeped: { $ne: true },
    },
    {
      $set: {
        status: "swept",
        sweeped: true,
        sweepTxHash,
        errorMessage: "",
      },
    },
    { new: true }
  );

  if (!updated) {
    const current = await HybridDeposit.findById(dep._id).lean();
    if (
      current?.status === "swept" &&
      (current.sweepTxHash === sweepTxHash || !current.sweepTxHash)
    ) {
      return { skipped: false, sweepTxHash, deduped: true };
    }
    throw new Error("Could not record sweep (state changed)");
  }

  return { skipped: false, sweepTxHash };
}

/**
 * Safe batch sweep: small batches, delay between txs, no batch size above 10.
 */
export const runHybridSweepBatch = async () => {
  if (!canSweepHybridFunds()) {
    return { ran: false, reason: "Sweep disabled or misconfigured", results: [] };
  }

  await HybridDeposit.updateMany(
    { status: "swept", sweeped: { $ne: true } },
    { $set: { sweeped: true } }
  ).catch(() => {});

  const limit = getSweepBatchSize();
  const deposits = await HybridDeposit.find({
    status: "credited",
    sweeped: { $ne: true },
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();

  const results = [];

  for (let i = 0; i < deposits.length; i += 1) {
    const d = deposits[i];
    if (d.sweeped) continue;

    try {
      const r = await executeSweepForDeposit(d);
      results.push({ depositId: String(d._id), ...r });
    } catch (err) {
      console.error("Hybrid sweep error:", String(d._id), err);
      await HybridDeposit.findByIdAndUpdate(d._id, {
        $set: { errorMessage: String(err.message || "Sweep failed").slice(0, 300) },
      }).catch(() => {});
      results.push({ depositId: String(d._id), error: err.message });
    }

    if (i < deposits.length - 1) {
      await sleep(SWEEP_DELAY_MS);
    }
  }

  const succeeded = results.filter((r) => r.sweepTxHash && !r.error).length;

  return { ran: true, attempted: deposits.length, succeeded, results };
};

/** Single deposit (manual / tests) — same safety checks as batch. */
export const sweepHybridDeposit = async (depositId) => {
  if (!canSweepHybridFunds()) {
    return { skipped: true, reason: "Hybrid sweep disabled" };
  }
  return executeSweepForDeposit({ _id: depositId });
};
