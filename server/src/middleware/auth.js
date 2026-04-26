import jwt from "jsonwebtoken";
import User from "../models/User.js";

const auth = async (req, res, next) => {
  try {
    const cookieToken = req.cookies?.token;
    const header = req.headers.authorization;
    const headerToken =
      header && header.startsWith("Bearer ") ? header.split(" ")[1] : null;
    const token = cookieToken || headerToken;

    // ❌ EMPTY TOKEN
    if (!token) {
      return res.status(401).json({ success: false, msg: "Token missing" });
    }

    // 🔐 VERIFY TOKEN
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔍 FETCH USER (LIGHT QUERY)
    const user = await User.findById(decoded.id)
      .select("_id email isBlocked vipLevel");

    if (!user) {
      return res.status(401).json({ success: false, msg: "User not found" });
    }

    // 🔒 BLOCK CHECK
    if (user.isBlocked) {
      return res.status(403).json({ success: false, msg: "Account blocked" });
    }

    const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const role = adminEmail && user.email === adminEmail ? "admin" : "user";

    // ✅ ATTACH USER (MINIMAL DATA)
    req.user = {
      _id: user._id,
      id: user._id, // legacy compatibility
      vipLevel: user.vipLevel,
      role,
    };

    next();

  } catch (err) {
    console.error("AUTH ERROR:", err.message);

    // 🔥 TOKEN EXPIRED
    if (err.name === "TokenExpiredError") {
      console.error("AUTH TOKEN EXPIRED");
      return res.status(401).json({ success: false, msg: "Token expired" });
    }

    // 🔥 INVALID TOKEN
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, msg: "Invalid token" });
    }

    return res.status(401).json({
      success: false,
      msg: "Authorization failed",
    });
  }
};

export default auth;