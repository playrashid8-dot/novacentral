import { HDNodeWallet, Wallet } from "ethers";
import HybridSetting from "../models/HybridSetting.js";
import { encryptText } from "../utils/crypto.js";
import { HYBRID_BASE_PATH } from "../utils/constants.js";

const reserveWalletIndex = async () => {
  const setting = await HybridSetting.findOneAndUpdate(
    { key: "walletCounter" },
    {
      $setOnInsert: { value: 0 },
      $inc: { value: 1 },
    },
    {
      new: true,
      upsert: true,
    }
  );

  return Number(setting?.value || 0);
};

const buildWalletFromMnemonic = async () => {
  const index = await reserveWalletIndex();
  const rootWallet = HDNodeWallet.fromPhrase(
    process.env.HYBRID_MNEMONIC,
    "",
    HYBRID_BASE_PATH
  );
  const wallet = rootWallet.deriveChild(index);

  return {
    walletAddress: wallet.address,
    privateKey: wallet.privateKey,
  };
};

const buildFallbackWallet = () => {
  const wallet = Wallet.createRandom();

  return {
    walletAddress: wallet.address,
    privateKey: wallet.privateKey,
  };
};

export const createUserWallet = async () => {
  const wallet = process.env.HYBRID_MNEMONIC
    ? await buildWalletFromMnemonic()
    : buildFallbackWallet();

  return {
    walletAddress: wallet.walletAddress,
    privateKey: encryptText(wallet.privateKey),
  };
};
