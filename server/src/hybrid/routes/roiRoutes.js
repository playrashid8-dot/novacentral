import express from "express";
import auth from "../../middleware/auth.js";
import { claimRoi } from "../controllers/roiController.js";

const router = express.Router();

router.post("/claim", auth, claimRoi);

export default router;
