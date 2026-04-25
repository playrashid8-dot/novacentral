import Investment from "../models/Investment.js";
import User from "../models/User.js";

export const runDailyROI = async () => {
  try {
    const now = new Date();

    console.log("⏳ Running Daily ROI...");

    const investments = await Investment.find({ status: "active" });

    for (let inv of investments) {
      try {
        // ❌ skip if already paid today
        if (inv.lastClaim) {
          const last = new Date(inv.lastClaim);
          const diff = now - last;

          if (diff < 24 * 60 * 60 * 1000) {
            continue;
          }
        }

        // 🔥 STOP AFTER PLAN DAYS (MOST IMPORTANT)
        if (inv.daysClaimed >= inv.duration) {
          inv.status = "completed";
          await inv.save();
          continue;
        }

        // 🔚 END DATE CHECK (backup safety)
        if (now >= inv.endDate) {
          inv.status = "completed";
          await inv.save();
          continue;
        }

        // 💰 CALCULATE PROFIT
        const profit = (inv.amount * inv.dailyROI) / 100;

        // 🔥 USER UPDATE (ATOMIC)
        await User.updateOne(
          { _id: inv.userId },
          {
            $inc: {
              balance: profit,
              totalEarnings: profit,
              todayProfit: profit,
            },
          }
        );

        // 🔥 UPDATE INVESTMENT
        inv.totalEarned = (inv.totalEarned || 0) + profit;
        inv.lastClaim = now;

        // 🔥 INCREMENT DAYS
        inv.daysClaimed += 1;

        await inv.save();

      } catch (innerErr) {
        console.log("❌ ROI Error (single user):", innerErr.message);
      }
    }

    console.log("✅ ROI distributed successfully");

  } catch (err) {
    console.error("❌ ROI CRON ERROR:", err.message);
  }
};