import express from "express";
import auth from "../middleware/auth.js";
import {
  createDeposit,
  approveDeposit,
  getMyDeposits,
} from "../controllers/depositController.js";

const router = express.Router();

/* ==============================
   📥 USER CREATE DEPOSIT
============================== */
router.post("/", auth, createDeposit);

/* ==============================
   📄 USER DEPOSIT HISTORY
============================== */
router.get("/my", auth, getMyDeposits);

/* ==============================
   🔐 ADMIN CHECK (BASIC)
============================== */
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ msg: "Unauthorized" });
  }
  next();
};

/* ==============================
   ✅ APPROVE DEPOSIT (ADMIN)
============================== */
router.post("/approve/:id", auth, isAdmin, approveDeposit);

/* ==============================
   ❌ REJECT DEPOSIT (OPTIONAL)
============================== */
router.post("/reject/:id", auth, isAdmin, async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);

    if (!deposit) {
      return res.status(404).json({ msg: "Deposit not found" });
    }

    deposit.status = "rejected";
    await deposit.save();

    res.json({
      success: true,
      msg: "Deposit rejected",
    });

  } catch (err) {
    res.status(500).json({ msg: "Error rejecting deposit" });
  }
});

export default router;