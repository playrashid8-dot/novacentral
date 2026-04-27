import { HDNodeWallet } from "ethers";
import hybridConfig from "../../config/hybridConfig.js";
import WalletCounter from "../models/WalletCounter.js";
import { encryptPrivateKey } from "../utils/crypto.js";

const reserveWalletIndex = async () => {
  const counter = await WalletCounter.findOneAndUpdate(
    { key: "wallet_index" },
    {
      $inc: { value: 1 },
    },
    {
      new: true,
      upsert: true,
    }
  );

  return Number(counter?.value || 0);
};

export const generateWallet = (index) => {
  const walletIndex = Number(index);

  if (!Number.isInteger(walletIndex) || walletIndex < 0) {
    throw new Error("Wallet index must be a non-negative integer");
  }

  const wallet = HDNodeWallet.fromPhrase(
    hybridConfig.mnemonic,
    "",
    `m/44'/60'/0'/0/${walletIndex}`
  );

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
};

const buildWalletFromMnemonic = async () => {
  const index = await reserveWalletIndex();
  const wallet = generateWallet(index);

  return {
    walletAddress: wallet.address,
    privateKey: wallet.privateKey,
  };
};

export const createUserWallet = async () => {
  const wallet = await buildWalletFromMnemonic();

  return {
    walletAddress: wallet.walletAddress,
    privateKey: encryptPrivateKey(wallet.privateKey),
  };
};
