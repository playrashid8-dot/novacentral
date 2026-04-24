import express from "express";
import dotenv from "dotenv";
import cors from "cors";

// 🔥 DB
import connectDB from "./config/db.js";

// 🔥 ROUTES
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import depositRoutes from "./routes/depositRoutes.js";
import adminRoutes from "./routes/adminRoutes.js"; // ✅ FIXED POSITION

// CONFIG
dotenv.config();
connectDB();

const app = express();

// 🔥 MIDDLEWARE
app.use(cors());
app.use(express.json());

// 🔥 ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/deposit", depositRoutes);
app.use("/api/admin", adminRoutes); // ✅ ADD HERE

// 🔥 TEST ROUTE
app.get("/", (req, res) => {
  res.send("API Running...");
});

// 🔥 SERVER START
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});