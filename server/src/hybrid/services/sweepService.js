import { Contract, JsonRpcProvider, Wallet, parseEther } from "ethers";
import User from "../../models/User.js";
import HybridDeposit from "../models/HybridDeposit.js";
import { decryptText } from "../utils/crypto.js";
import { BSC_USDT_ABI, HYBRID_TOKEN } from "../utils/constants.js";

const isEnabled = (value) => String(value).toLowerCase() === "true";

const getProvider = () => {
  if (!process.env.HYBRID_BSC_RPC_URL) {
    throw new Error("HYBRID_BSC_RPC_URL missing");
  }

  return new JsonRpcProvider(process.env.HYBRID_BSC_RPC_URL);
};

export const canSweepHybridFunds = () =>
  isEnabled(process.env.HYBRID_EARN_ENABLED) &&
  isEnabled(process.env.HYBRID_SWEEP_ENABLED) &&
  !!process.env.HYBRID_ADMIN_WALLET &&
  !!process.env.HYBRID_USDT_CONTRACT &&
  !!process.env.HYBRID_GAS_FUNDER_PRIVATE_KEY;

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
  const gasFunder = new Wallet(process.env.HYBRID_GAS_FUNDER_PRIVATE_KEY, provider);
  const userWallet = new Wallet(decryptText(user.privateKey), provider);
  const tokenContract = new Contract(
    process.env.HYBRID_USDT_CONTRACT,
    BSC_USDT_ABI,
    userWallet
  );

  const gasAmount = process.env.HYBRID_SWEEP_GAS_AMOUNT || "0.0005";
  const gasTx = await gasFunder.sendTransaction({
    to: user.walletAddress,
    value: parseEther(gasAmount),
  });
  await gasTx.wait();

  const currentBalance = await tokenContract.balanceOf(user.walletAddress);

  if (currentBalance <= 0n) {
    throw new Error("No token balance available to sweep");
  }

  const sweepTx = await tokenContract.transfer(process.env.HYBRID_ADMIN_WALLET, currentBalance);
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
