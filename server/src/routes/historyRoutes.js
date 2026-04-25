import express from "express";
import Transaction from "../models/Transaction.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// ✅ GET USER HISTORY
router.get("/", auth, async (req, res) => {
  try {
    const data = await Transaction.find({ user: req.user.id })
      .sort({ createdAt: -1 });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;