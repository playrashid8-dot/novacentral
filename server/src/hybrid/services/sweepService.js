import { Contract, Wallet, isAddress, parseEther, parseUnits } from "ethers";
import hybridConfig from "../../config/hybridConfig.js";
import User from "../../models/User.js";
import HybridDeposit from "../models/HybridDeposit.js";
import { decryptPrivateKey } from "../utils/crypto.js";
import { BSC_USDT_ABI, HYBRID_TOKEN } from "../utils/constants.js";
import { getProvider } from "../utils/provider.js";

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
  !!hybridConfig.rpcUrl;

export const sendGas = async (address) => {
  try {
    assertSweepConfig();

    if (!isAddress(address)) {
      throw new Error("Valid recipient address is required");
    }

    const gasFunder = new Wallet(hybridConfig.gasKey, getProvider());
    const gasAmount = process.env.HYBRID_SWEEP_GAS_AMOUNT || "0.0005";
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

export const sweepUSDT = async (userPrivateKey, amount) => {
  try {
    assertSweepConfig();

    const amountValue = typeof amount === "bigint" ? amount : Number(amount);

    if (
      (typeof amountValue === "bigint" && amountValue <= 0n) ||
      (typeof amountValue !== "bigint" && (!Number.isFinite(amountValue) || amountValue <= 0))
    ) {
      throw new Error("Sweep amount must be greater than zero");
    }

    const provider = getProvider();
    const decryptedPrivateKey = decryptPrivateKey(userPrivateKey);
    const userWallet = new Wallet(decryptedPrivateKey, provider);
    const tokenContract = new Contract(hybridConfig.usdtContract, BSC_USDT_ABI, userWallet);
    const tokenAmount =
      typeof amount === "bigint"
        ? amount
        : parseUnits(String(amount), HYBRID_TOKEN.decimals);

    const sweepTx = await tokenContract.transfer(hybridConfig.adminWallet, tokenAmount);
    const receipt = await sweepTx.wait();

    return {
      txHash: String(receipt?.hash || sweepTx.hash || "").toLowerCase(),
    };
  } catch (error) {
    throw new Error(`Failed to sweep USDT: ${error.message}`);
  }
};

export const sweepHybridDeposit = async (depositId) => {
  if (!canSweepHybridFunds()) {
    return { skipped: true, reason: "Hybrid sweep disabled" };
  }

  const deposit = await HybridDeposit.findById(depositId);

  if (!deposit || deposit.status === "swept") {
    return { skipped: true, reason: "Deposit unavailable" };
  }

  const user = await User.findById(deposit.userId).select("+privateKey walletAddress");

  if (!user?.privateKey || !user?.walletAddress) {
    throw new Error("User wallet credentials missing");
  }

  const provider = getProvider();
  const userWallet = new Wallet(decryptPrivateKey(user.privateKey), provider);
  const tokenContract = new Contract(hybridConfig.usdtContract, BSC_USDT_ABI, userWallet);

  await sendGas(user.walletAddress);

  const currentBalance = await tokenContract.balanceOf(user.walletAddress);

  if (currentBalance <= 0n) {
    throw new Error("No token balance available to sweep");
  }

  const sweepTx = await tokenContract.transfer(hybridConfig.adminWallet, currentBalance);
  await sweepTx.wait();

  await HybridDeposit.findByIdAndUpdate(deposit._id, {
    $set: {
      status: "swept",
      sweepTxHash: String(sweepTx.hash || "").toLowerCase(),
      errorMessage: "",
    },
  });

  return {
    skipped: false,
    sweepTxHash: String(sweepTx.hash || "").toLowerCase(),
  };
};
