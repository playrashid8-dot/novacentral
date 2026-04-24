import express from "express";
import auth from "../middleware/auth.js";
import { createDeposit, approveDeposit } from "../controllers/depositController.js";

const router = express.Router();

router.post("/", auth, createDeposit);
router.put("/approve/:id", approveDeposit); // admin

export default router;