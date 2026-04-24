import express from "express";
import { register, login } from "../controllers/authController.js";

const router = express.Router();

// 🔥 REGISTER (IMPORTANT FIX)
router.post("/register", register);

// 🔐 LOGIN
router.post("/login", login);

export default router;