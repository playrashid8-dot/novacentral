import User from "../models/User.js";

const vipLevels = [
  { level: 1, directs: 5, team: 20, bonus: 50 },
  { level: 2, directs: 10, team: 50, bonus: 150 },
  { level: 3, directs: 20, team: 150, bonus: 500 },
];

export const updateVIP = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) return;

    // ✅ ensure array exists
    if (!user.claimedVIP) {
      user.claimedVIP = [];
    }

    let updated = false;

    for (let vip of vipLevels) {
      const alreadyClaimed = user.claimedVIP.includes(vip.level);

      if (
        user.directCount >= vip.directs &&
        user.teamCount >= vip.team &&
        !alreadyClaimed
      ) {
        // 🎉 upgrade (only upward)
        if (vip.level > user.vipLevel) {
          user.vipLevel = vip.level;
        }

        // 💰 bonus
        user.balance += vip.bonus;
        user.totalEarnings += vip.bonus;

        // optional field
        user.vipEarnings = (user.vipEarnings || 0) + vip.bonus;

        // ✅ mark claimed
        user.claimedVIP.push(vip.level);

        updated = true;

        console.log(`🎉 VIP ${vip.level} bonus given`);
      }
    }

    // 🔥 save once (important)
    if (updated) {
      await user.save();
    }

  } catch (err) {
    console.error("VIP ERROR:", err.message);
  }
};