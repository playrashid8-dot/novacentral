import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import csrf from "csurf";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// 🔥 DB
import connectDB from "./config/db.js";
import { isMailConfigured, verifyMailConnection } from "./utils/mailService.js";

// 🔥 ROUTES
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import depositRoutes from "./routes/depositRoutes.js";
import investmentRoutes from "./routes/investmentRoutes.js";
import withdrawalRoutes from "./routes/withdrawalRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";
import { roiRoutes, salaryRoutes, stakingRoutes, withdrawRoutes, hybridDepositRoutes } from "./hybrid/routes/index.js";
import { startHybridEngine } from "./hybrid/engine/index.js";

// 🔧 CONFIG
dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET missing");
}

const app = express();

const isProd = process.env.NODE_ENV === "production";

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  },
});

function isCorsOriginAllowed(origin) {
  if (!origin) return true;

  const allowedOrigins = [
    "http://localhost:3000",
    "https://novacentral.vercel.app",
    ...(process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ];

  if (allowedOrigins.includes(origin)) return true;

  // allow all Vercel preview deployments (https://*.vercel.app)
  if (origin.endsWith(".vercel.app")) return true;

  return false;
}

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (isCorsOriginAllowed(origin)) {
      return callback(null, true);
    }

    console.error("❌ Blocked by CORS:", origin);

    const err = new Error("CORS not allowed");
    err.status = 403;
    return callback(err);
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "CSRF-Token",
    "csrf-token",
    "X-CSRF-Token",
    "X-XSRF-Token",
    "X-Requested-With",
  ],
};

/* ==============================
   🔥 TRUST PROXY (Railway fix)
============================== */
app.set("trust proxy", 1);

/* ==============================
   🔥 CONNECT DATABASE
============================== */
await connectDB();

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED:", err);
});

process.on("uncaughtException", (err) => {
  console.error("CRASH:", err);
});

/* ==============================
   🔐 GLOBAL SECURITY
============================== */

// ✅ CORS (dynamic origin — credentials + Vercel preview *.vercel.app)
app.use(cors(corsOptions));

// ✅ COOKIES FIRST (needed before CSRF / body-dependent verification)
app.use(cookieParser());
// ✅ BODY PARSER (LIMITED SIZE)
app.use(express.json({ limit: "10kb" }));
// ✅ CSRF (after cookieParser + JSON — required for cookie-based secrets)
app.use(csrfProtection);

app.get("/api/csrf-token", (req, res) => {
  const token = req.csrfToken();

  res.cookie("XSRF-TOKEN", token, {
    httpOnly: false,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/", // ensure global access
  });

  res.json({
    success: true,
    msg: "CSRF token generated",
    data: { csrfToken: token },
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    msg: "API working",
    data: {},
  });
});

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
  keyGenerator: (req) => ipKeyGenerator(req.ip),
});

app.use(globalLimiter);

/* ==============================
   🔐 AUTH RATE LIMIT (STRICT)
============================== */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
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
app.use("/api/roi", roiRoutes);
app.use("/api/salary", salaryRoutes);
app.use("/api/stake", stakingRoutes);
app.use("/api/withdraw", withdrawRoutes);
app.use("/api/hybrid/deposit", hybridDepositRoutes);

/* ==============================
   🧪 HEALTH CHECK
============================== */
app.get("/", (req, res) => {
  res.json({
    success: true,
    msg: "🚀 NovaCentral API running",
    data: { time: new Date() },
  });
});

/* ==============================
   ❌ 404 HANDLER
============================== */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    msg: "Route not found ❌",
    data: null,
  });
});

/* ==============================
   🔥 GLOBAL ERROR HANDLER
============================== */
app.use((err, req, res, next) => {
  if (err?.code === "EBADCSRFTOKEN") {
    return res.status(403).json({
      success: false,
      msg: "Invalid or missing CSRF token",
      data: null,
    });
  }
  console.error("❌ Server Error:", err.stack);

  res.status(err.status || 500).json({
    success: false,
    msg: err.message || "Internal Server Error",
    data: null,
  });
});

/* ==============================
   🚀 START SERVER
============================== */
const PORT = process.env.PORT || 5000;

startHybridEngine();

app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
  if (isMailConfigured()) {
    console.log("Email service configured ✅");
    verifyMailConnection().catch((e) => {
      console.error("❌ EMAIL ERROR:", e.message);
    });
  } else {
    console.warn("Email service not configured ❌");
  }
});