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
    console.log("USER:", req.user);
    console.log("ACTION:", "admin.check");

    if (!req.user?._id || req.user.role !== "admin") {
      return res.status(403).json({ success: false, msg: "Admin access only" });
    }

    const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const user = await User.findById(req.user._id).select("_id email");

    if (!user || user.email !== adminEmail) {
      return res.status(403).json({ success: false, msg: "Admin access only" });
    }

    next();
  } catch (err) {
    console.log("ERROR:", err.message);
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