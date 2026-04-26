import express from "express";
import auth from "../middleware/auth.js";
import User from "../models/User.js";

import {
  createWithdrawal,
  getMyWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
} from "../controllers/withdrawalController.js";

const router = express.Router();

/* ==============================
   🔐 ADMIN CHECK
============================== */
const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ success: false, msg: "Admin access only" });
    }

    next();
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
};

/* ==============================
   👤 USER ROUTES
============================== */
router.post("/", auth, createWithdrawal);
router.get("/my", auth, getMyWithdrawals);

/* ==============================
   👑 ADMIN ROUTES
============================== */
router.post("/approve/:id", auth, isAdmin, approveWithdrawal);
router.post("/reject/:id", auth, isAdmin, rejectWithdrawal);

export default router;