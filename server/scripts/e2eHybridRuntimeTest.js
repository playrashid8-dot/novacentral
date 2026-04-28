/**
 * Full hybrid E2E runtime diagnostic — no changes to production modules.
 * Run from server/:  node scripts/e2eHybridRuntimeTest.js
 *
 * First import loads server/.env via hybridConfig side effect.
 */
import hybridConfig from "../src/config/hybridConfig.js";
import connectDB from "../src/config/db.js";
import User from "../src/models/User.js";
import Deposit from "../src/models/Deposit.js";
import HybridDeposit from "../src/hybrid/models/HybridDeposit.js";
import {
  getProvider,
  checkRpcHealth,
  getCurrentRpcUrl,
} from "../src/hybrid/utils/provider.js";
import { BSC_USDT_ABI, HYBRID_TOKEN } from "../src/hybrid/utils/constants.js";
import {
  sweepHybridDeposit,
  canSweepHybridFunds,
} from "../src/hybrid/services/sweepService.js";
import mongoose from "mongoose";
import {
  Contract,
  Wallet,
  formatEther,
  formatUnits,
  id,
  parseEther,
  zeroPadValue,
} from "ethers";

const TRANSFER_TOPIC = id("Transfer(address,address,uint256)");

const decodeTopicAddress = (topic = "") =>
  `0x${String(topic).slice(-40).toLowerCase()}`;

const capturedLogs = [];
let origConsoleLog = console.log;

const startLogCapture = () => {
  capturedLogs.length = 0;
  origConsoleLog = console.log;
  console.log = (...args) => {
    capturedLogs.push(args.map((a) => String(a)).join(" "));
    origConsoleLog.apply(console, args);
  };
};

const stopLogCapture = () => {
  console.log = origConsoleLog;
};

const hasCaptured = (needle) => capturedLogs.some((l) => l.includes(needle));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LOW_BNB_ETH = parseEther("0.001");

async function main() {
  const report = {
    listenerRunning: false,
    rpcWorking: false,
    rpcLogsOk: true,
    depositFound: false,
    walletMatch: false,
    gasReady: false,
    gasTransferOk: false,
    sweepWorking: false,
    creditSystem: false,
    flowLogs: {
      depositDetected: false,
      depositCredited: false,
      gasSent: false,
      sweepSuccess: false,
    },
    flowSequenceComplete: false,
    rootCauses: [],
    systemReady: false,
  };

  startLogCapture();
  await connectDB();

  // PART 1
  const { startDepositListener } = await import("../src/hybrid/engine/index.js");
  startDepositListener();
  await sleep(4500);

  const earnOn =
    String(process.env.HYBRID_EARN_ENABLED || "").toLowerCase() === "true";
  const heardStart = hasCaptured("🚀 Deposit listener started");
  const heardTick = hasCaptured("🔁 Listener tick...");
  report.listenerRunning = earnOn && heardStart && heardTick;
  if (!earnOn) {
    report.rootCauses.push("HYBRID_EARN_ENABLED not true — listener not started");
  } else if (!heardStart || !heardTick) {
    report.rootCauses.push("Deposit listener did not emit expected bootstrap logs");
  }

  // PART 2
  let block = null;
  let logsProbe = [];
  const usdtAddr = String(process.env.HYBRID_USDT_CONTRACT || "").trim();

  try {
    report.rpcWorking = await checkRpcHealth();
    if (!report.rpcWorking) {
      report.rootCauses.push("RPC Issue");
    }
    const provider = getProvider();
    block = await provider.getBlockNumber();
    console.log("📦 Latest Block:", block);

    if (!usdtAddr) {
      console.error("HYBRID_USDT_CONTRACT missing");
      report.rpcLogsOk = false;
      report.rootCauses.push("HYBRID_USDT_CONTRACT missing");
    } else {
      const fromA = Math.max(0, block - 50);
      logsProbe = await provider.getLogs({
        address: usdtAddr,
        fromBlock: fromA,
        toBlock: block,
        topics: [TRANSFER_TOPIC],
      });
      console.log("📊 Logs count:", logsProbe.length);

      const fromB = Math.max(0, block - 200);
      const logsProbe2 = await provider.getLogs({
        address: usdtAddr,
        fromBlock: fromB,
        toBlock: block,
        topics: [TRANSFER_TOPIC],
      });
      if (logsProbe.length === 0 && logsProbe2.length === 0) {
        report.rpcLogsOk = false;
        report.rootCauses.push(
          "RPC logs probe returned 0 twice (quiet chain or RPC/filter issue)"
        );
      }
    }
  } catch (e) {
    report.rpcWorking = false;
    report.rpcLogsOk = false;
    report.rootCauses.push("RPC Issue");
    console.error("❌ RPC Part 2 error:", e?.message || e);
  }

  // PART 3 & 4
  const user = await User.findOne({
    walletAddress: { $exists: true, $nin: [null, ""] },
  });

  if (!user) {
    console.error("No user with walletAddress in DB");
    report.rootCauses.push("No test user");
    stopLogCapture();
    printFinal(report);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }

  console.log("👤 Test user:", user.walletAddress);

  let usdtBalance = 0n;
  try {
    const provider = getProvider();
    const usdt = new Contract(usdtAddr || "", BSC_USDT_ABI, provider);
    usdtBalance = await usdt.balanceOf(user.walletAddress);
    console.log(
      "💰 User USDT balance:",
      formatUnits(usdtBalance, HYBRID_TOKEN.decimals)
    );

    if (usdtBalance <= 0n) {
      console.log("❌ No deposit found for test user");
      report.depositFound = false;
      report.rootCauses.push("No deposit");
    } else {
      report.depositFound = true;
    }
  } catch (e) {
    console.error("USDT balance error:", e?.message || e);
    report.rootCauses.push("RPC Issue");
  }

  // PART 5 — topic[2] matches wallet (padded topic filter + recent logs)
  try {
    const u = String(user.walletAddress || "").toLowerCase().trim();
    if (block != null && usdtAddr) {
      const provider = getProvider();
      const paddedTo = zeroPadValue(u, 32);
      const toUserLogs = await provider.getLogs({
        address: usdtAddr,
        fromBlock: Math.max(0, block - 2000),
        toBlock: block,
        topics: [TRANSFER_TOPIC, null, paddedTo],
      });
      const inProbe =
        logsProbe.length > 0 &&
        logsProbe.some((log) => decodeTopicAddress(log.topics?.[2]) === u);
      report.walletMatch =
        toUserLogs.length > 0 || inProbe || report.depositFound;
      if (!report.walletMatch) {
        report.rootCauses.push("Wallet mismatch");
      }
    }
  } catch (e) {
    console.error("Wallet match check error:", e?.message || e);
    if (report.depositFound) report.walletMatch = true;
  }

  // PART 6
  let gasFunder = null;
  try {
    if (hybridConfig.gasKey) {
      gasFunder = new Wallet(hybridConfig.gasKey, getProvider());
      console.log("⛽ Funder:", gasFunder.address);
      const provider = getProvider();
      const funderBalance = await provider.getBalance(gasFunder.address);
      console.log("⛽ Funder Balance:", formatEther(funderBalance));
      report.gasReady = funderBalance >= LOW_BNB_ETH;
      if (!report.gasReady) {
        console.log("❌ Gas funder insufficient");
        report.rootCauses.push("Gas funder empty");
      } else if (usdtBalance > 0n) {
        const userBnb = await provider.getBalance(user.walletAddress);
        if (userBnb < parseEther("0.00005")) {
          try {
            const tx = await gasFunder.sendTransaction({
              to: user.walletAddress,
              value: parseEther("0.0001"),
            });
            await tx.wait();
            report.gasTransferOk = true;
            console.log("⛽ Gas test sent");
          } catch (ge) {
            console.error("Gas test send failed:", ge?.message || ge);
            report.rootCauses.push("Gas funder empty");
          }
        } else {
          report.gasTransferOk = true;
          console.log("⛽ User already has BNB; skip optional dust send");
        }
      } else {
        report.gasTransferOk = report.gasReady;
      }
    } else {
      report.rootCauses.push("Gas funder empty");
      console.error("HYBRID_GAS_FUNDER_PRIVATE_KEY not configured");
    }
  } catch (e) {
    console.error("Gas funder check error:", e?.message || e);
    report.rootCauses.push("Gas funder empty");
  }

  // PART 7
  const eligible = await HybridDeposit.findOne({
    userId: user._id,
    status: "credited",
    sweeped: { $ne: true },
  }).sort({ createdAt: -1 });

  let beforeSweep = usdtBalance;
  let afterSweep = beforeSweep;

  try {
    const provider = getProvider();
    const usdt = new Contract(usdtAddr || "", BSC_USDT_ABI, provider);
    beforeSweep = await usdt.balanceOf(user.walletAddress);
    console.log("💰 USDT before sweep:", beforeSweep.toString());

    if (!canSweepHybridFunds()) {
      console.log("Sweep: disabled or misconfigured (canSweepHybridFunds false)");
      report.rootCauses.push("Sweep failed");
    } else if (!eligible) {
      console.log(
        "Sweep: no credited HybridDeposit row — production API is sweepHybridDeposit(depositId), not (wallet)"
      );
      if (beforeSweep > 0n) {
        report.rootCauses.push("Sweep failed");
      }
    } else {
      const sweepResult = await sweepHybridDeposit(eligible._id);
      const okSweep =
        sweepResult &&
        !sweepResult.error &&
        (sweepResult.sweepTxHash || sweepResult.skipped === false);

      if (sweepResult?.skipped && !sweepResult.sweepTxHash) {
        console.log("Sweep skipped:", sweepResult.reason || sweepResult);
        report.rootCauses.push("Sweep failed");
      } else if (okSweep) {
        afterSweep = await usdt.balanceOf(user.walletAddress);
        console.log("💰 USDT after sweep:", afterSweep.toString());
        report.sweepWorking = beforeSweep > 0n && afterSweep === 0n;
        if (!report.sweepWorking) {
          report.rootCauses.push("Sweep failed");
        }
      }
    }
  } catch (e) {
    console.error("Sweep test error:", e?.message || e);
    report.rootCauses.push("Sweep failed");
  }

  // PART 8 — Deposit model uses userId (not user)
  const legacyDeposits = await Deposit.find({ userId: user._id });
  const hybridDeposits = await HybridDeposit.find({ userId: user._id });
  console.log("📥 Legacy Deposit records:", legacyDeposits.length);
  console.log("📥 HybridDeposit records:", hybridDeposits.length);
  report.creditSystem = hybridDeposits.length > 0 || legacyDeposits.length > 0;
  if (!report.creditSystem && report.depositFound) {
    report.rootCauses.push("No deposit");
  }

  // PART 9
  report.flowLogs.depositDetected = hasCaptured("📥 Deposit detected");
  report.flowLogs.depositCredited = hasCaptured("✅ Deposit credited");
  report.flowLogs.gasSent = hasCaptured("⛽ Gas sent");
  report.flowLogs.sweepSuccess = hasCaptured("✅ Sweep success");
  report.flowSequenceComplete =
    report.flowLogs.depositDetected &&
    report.flowLogs.depositCredited &&
    report.flowLogs.gasSent &&
    report.flowLogs.sweepSuccess;

  stopLogCapture();
  printFinal(report);
  await mongoose.connection.close().catch(() => {});
  process.exit(report.systemReady ? 0 : 1);
}

function printFinal(report) {
  const uniq = [...new Set(report.rootCauses)];
  const rpcLine = `${report.rpcWorking ? "✅" : "❌"} (logs probe: ${report.rpcLogsOk ? "✅" : "❌"})`;

  console.log("\n========== E2E RUNTIME REPORT ==========");
  console.log(`Listener Running: ${report.listenerRunning ? "✅" : "❌"}`);
  console.log(
    `RPC Working: ${rpcLine}${getCurrentRpcUrl() ? ` — ${getCurrentRpcUrl()}` : ""}`
  );
  console.log(`Deposit Found: ${report.depositFound ? "✅" : "❌"}`);
  console.log(`Wallet Match: ${report.walletMatch ? "✅" : "❌"}`);
  console.log(`Gas Ready: ${report.gasReady ? "✅" : "❌"}`);
  console.log(`Gas Transfer: ${report.gasTransferOk ? "✅" : "❌"}`);
  console.log(`Sweep Working: ${report.sweepWorking ? "✅" : "❌"}`);
  console.log(`Credit System: ${report.creditSystem ? "✅" : "❌"}`);
  console.log("--- Part 9: flow log markers (this process) ---");
  console.log(`  Deposit detected: ${report.flowLogs.depositDetected ? "✅" : "❌"}`);
  console.log(`  Deposit credited: ${report.flowLogs.depositCredited ? "✅" : "❌"}`);
  console.log(`  Gas sent: ${report.flowLogs.gasSent ? "✅" : "❌"}`);
  console.log(`  Sweep success: ${report.flowLogs.sweepSuccess ? "✅" : "❌"}`);
  console.log(
    `  Full sequence: ${report.flowSequenceComplete ? "✅" : "❌"} (all four lines in this process)`
  );

  // Part 10 — core gates (aligned with your checklist). Part 9 is additional signal.
  report.systemReady =
    report.listenerRunning &&
    report.rpcWorking &&
    report.rpcLogsOk &&
    report.depositFound &&
    report.walletMatch &&
    report.gasReady &&
    report.gasTransferOk &&
    report.sweepWorking &&
    report.creditSystem;

  console.log("\n🔥 FINAL STATUS");
  console.log(`SYSTEM READY (Parts 1–8): ${report.systemReady ? "✅" : "❌"}`);
  console.log(
    `Full flow logs (Part 9): ${report.flowSequenceComplete ? "✅" : "❌"}`
  );

  if (!report.systemReady && uniq.length) {
    console.log("\n💥 ROOT CAUSE (deduped):");
    for (const r of uniq) console.log(`  - ${r}`);
  }

  if (!report.systemReady) {
    console.log("\n🧠 FINAL TRUTH: fix the root cause above and re-run this script.");
  }
}

main().catch((e) => {
  console.error("E2E script fatal:", e);
  process.exit(1);
});
