import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

// 🔥 DB
import connectDB from "./config/db.js";

// 🔥 ROUTES
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import depositRoutes from "./routes/depositRoutes.js";
import investmentRoutes from "./routes/investmentRoutes.js";
import withdrawalRoutes from "./routes/withdrawalRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";

// 🔧 CONFIG
dotenv.config();

const app = express();
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://novacentral.vercel.app",
  ],
  credentials: true,
};

/* ==============================
   🔥 TRUST PROXY (Railway fix)
============================== */
app.set("trust proxy", 1);

/* ==============================
   🔥 CONNECT DATABASE
============================== */
connectDB();

/* ==============================
   🔐 GLOBAL SECURITY
============================== */

// ✅ CORS
app.use(cors(corsOptions));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// ✅ BODY PARSER (LIMITED SIZE)
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

// ✅ HELMET (SECURITY HEADERS)
app.use(helmet());

// ✅ LOGGER
app.use(morgan("dev"));

/* ==============================
   🚫 GLOBAL RATE LIMIT (ANTI DDOS)
============================== */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

/* ==============================
   🔐 AUTH RATE LIMIT (STRICT)
============================== */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    msg: "Too many requests, try again later ❌",
    data: null,
  },
});

/* ==============================
   🔥 ROUTE LOGGER (DEV)
============================== */
app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.originalUrl}`);
  next();
});

/* ==============================
   🔥 API ROUTES
============================== */
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/deposit", depositRoutes);
app.use("/api/investment", investmentRoutes);
app.use("/api/withdrawal", withdrawalRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/history", historyRoutes);

/* ==============================
   🧪 HEALTH CHECK
============================== */
app.get("/", (req, res) => {
  res.json({
    success: true,
    msg: "🚀 NovaCentral API running",
    time: new Date(),
  });
});

/* ==============================
   ❌ 404 HANDLER
============================== */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    msg: "Route not found ❌",
  });
});

/* ==============================
   🔥 GLOBAL ERROR HANDLER
============================== */
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.stack);

  res.status(err.status || 500).json({
    success: false,
    msg: err.message || "Internal Server Error",
  });
});

/* ==============================
   🚀 START SERVER
============================== */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});