import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";

dotenv.config();

const app = express();


// 🔥 CORS (Production Ready)
app.use(cors({
  origin: "*", // production me specific domain lagana better hota hai
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));


// 🔧 BODY PARSER
app.use(express.json());


// 🧠 DATABASE CONNECT
connectDB();


// 🔗 ROUTES
app.use("/api/auth", authRoutes);


// 🧪 HEALTH CHECK (IMPORTANT for Railway)
app.get("/", (req, res) => {
  res.send("NovaCentral API Running 🚀");
});


// ❌ 404 HANDLER
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});


// ❌ GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Server Error" });
});


// 🚀 START SERVER
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT} 🚀`);
});