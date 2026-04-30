import "dotenv/config";
if (process.env.NODE_ENV !== "production") {
  console.log("ENV CHECK REDIS:", process.env.REDIS_URL ? "FOUND ✅" : "MISSING ❌");
}
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import csrf from "csurf";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

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
import { roiRoutes, salaryRoutes, stakingRoutes, withdrawRoutes, hybridDepositRoutes } from "./hybrid/routes/index.js";
import { startHybridEngine, runHybridStartupRecovery } from "./hybrid/engine/index.js";
import { startRealtimeListener } from "./hybrid/listeners/realtimeListener.js";

process.on("uncaughtException", (err) => {
  console.error("CRASH:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("REJECTION:", err);
});

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET missing");
}

const app = express();
const PORT = process.env.PORT || 5000;

const isProd =
  process.env.NODE_ENV === "production" ||
  process.env.RAILWAY_ENVIRONMENT === "production";

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  },
});

/** Browsers send Origin without a trailing slash — never require "/" on configured hosts. */
function normalizeCorsOrigin(origin) {
  if (!origin) return "";
  return String(origin).replace(/\/$/, "");
}

const allowedOrigins = [
  "https://hybridearn.com",
  "https://www.hybridearn.com",
  "http://localhost:3000",
];

const corsAllowedOrigins = new Set(allowedOrigins);
const devVercelOriginPattern = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

function isCorsOriginAllowed(origin) {
  if (!origin) return true;
  const n = normalizeCorsOrigin(origin);
  if (corsAllowedOrigins.has(n)) return true;
  if (process.env.NODE_ENV !== "production" && devVercelOriginPattern.test(n)) return true;
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
  optionsSuccessStatus: 204,
  allowedHeaders: [
    "Content-Type",
    "CSRF-Token",
    "csrf-token",
    "X-CSRF-Token",
    "X-XSRF-Token",
    "X-Requested-With",
    "Idempotency-Key",
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

/**
 * infra: NOVA_SERVICE=api → stateless HTTP only (scaled behind LB).
 * NOVA_SERVICE=hybrid → run src/hybridService.js (not this file) for WS + engine.
 * default / all → full monolith including hybrid listeners (backward compatible).
 */
const novaService = (process.env.NOVA_SERVICE ?? "all").trim().toLowerCase();
const hybridStackEnabled = novaService !== "api" && novaService !== "hybrid";

/* ==============================
   🔐 GLOBAL SECURITY
============================== */

// ✅ CORS (strict production whitelist)
app.use(cors(corsOptions));

// ✅ COOKIES FIRST (needed before CSRF / body-dependent verification)
app.use(cookieParser());
// ✅ BODY PARSER (LIMITED SIZE)
app.use(express.json({ limit: "10kb" }));
// ✅ CSRF (after cookieParser + JSON — required for cookie-based secrets)
app.use(csrfProtection);

// ✅ HELMET (SECURITY HEADERS) — before routes so health + API share headers
app.use(helmet());

app.get("/api/csrf-token", (req, res) => {
  const token = req.csrfToken();

  res.cookie("XSRF-TOKEN", token, {
    httpOnly: false,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
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
    msg: "Health check ok",
    data: { status: "ok" },
  });
});

// ✅ LOGGER
app.use(morgan("dev"));

/* ==============================
   🚫 GLOBAL RATE LIMIT (ANTI DDOS)
============================== */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
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
  max: 25,
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
  if (process.env.NODE_ENV !== "production") {
    console.log(`➡️ ${req.method} ${req.originalUrl}`);
  }
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
    msg: "API running",
    data: null,
  });
});

app.get("/api", (req, res) => {
  res.json({
    success: true,
    msg: "API working",
    data: null,
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
    msg: err.status && err.status < 500 ? err.message : "Internal server error",
    data: null,
  });
});

/* ==============================
   🚀 START SERVER
============================== */
if (hybridStackEnabled) {
  await startRealtimeListener();
  await runHybridStartupRecovery({ blocks: 1000 });
  startHybridEngine();
}

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
  if (!hybridStackEnabled) {
    console.log(`📦 NOVA_SERVICE=${novaService} — hybrid stack disabled here (listener runs in src/hybridService.js)`);
  }
});