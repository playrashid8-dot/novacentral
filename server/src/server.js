import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// 🔥 DB
import connectDB from "./config/db.js";

// 🔥 ROUTES
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import depositRoutes from "./routes/depositRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

// CONFIG
dotenv.config();

const app = express();

/* ==============================
   🔥 CONNECT DB (SAFE WAY)
============================== */
connectDB();

/* ==============================
   🔐 SECURITY + MIDDLEWARE
============================== */
app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(morgan("dev"));

/* ==============================
   🔥 ROUTE LOGGER (OPTIONAL)
============================== */
app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.url}`);
  next();
});

/* ==============================
   🔥 API ROUTES
============================== */
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/deposit", depositRoutes);
app.use("/api/admin", adminRoutes);

/* ==============================
   🧪 TEST ROUTE
============================== */
app.get("/", (req, res) => {
  res.send("🚀 API Running...");
});

/* ==============================
   ❌ 404 HANDLER
============================== */
app.use((req, res) => {
  res.status(404).json({
    msg: "Route not found",
  });
});

/* ==============================
   🔥 GLOBAL ERROR HANDLER
============================== */
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.message);

  res.status(500).json({
    msg: "Internal Server Error",
  });
});

/* ==============================
   🚀 START SERVER
============================== */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});