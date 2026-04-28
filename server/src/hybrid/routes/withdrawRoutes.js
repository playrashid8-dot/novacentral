import express from "express";
import auth from "../../middleware/auth.js";
import { claimWithdraw, getMyHybridWithdrawals, requestWithdraw } from "../controllers/withdrawController.js";

const router = express.Router();

router.post("/request", auth, requestWithdraw);
router.post("/claim", auth, claimWithdraw);
router.get("/my", auth, getMyHybridWithdrawals);

export default router;
