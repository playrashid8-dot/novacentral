import jwt from "jsonwebtoken";
import User from "../models/User.js";

const auth = async (req, res, next) => {
  try {
    console.log("Incoming cookies:", req.cookies);
    const cookieToken = req.cookies?.token;
    const header = req.headers.authorization;
    const headerToken =
      header && header.startsWith("Bearer ") ? header.split(" ")[1] : null;
    const token = cookieToken || headerToken;
    const tokenSource = cookieToken ? "cookie" : headerToken ? "header" : "none";
    console.log("AUTH CHECK:", {
      path: req.originalUrl,
      tokenSource,
      hasCookieToken: Boolean(cookieToken),
      hasHeaderToken: Boolean(headerToken),
      cookieKeys: Object.keys(req.cookies || {}),
    });

    // ❌ EMPTY TOKEN
    if (!token) {
      return res.status(401).json({ msg: "Token missing" });
    }

    // 🔐 VERIFY TOKEN
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔍 FETCH USER (LIGHT QUERY)
    const user = await User.findById(decoded.id)
      .select("_id isBlocked vipLevel");

    if (!user) {
      return res.status(401).json({ msg: "User not found" });
    }

    // 🔒 BLOCK CHECK
    if (user.isBlocked) {
      return res.status(403).json({ msg: "Account blocked" });
    }

    // ✅ ATTACH USER (MINIMAL DATA)
    req.user = {
      _id: user._id,
      id: user._id, // legacy compatibility
      vipLevel: user.vipLevel,
    };

    next();

  } catch (err) {
    console.error("AUTH ERROR:", err.message);

    // 🔥 TOKEN EXPIRED
    if (err.name === "TokenExpiredError") {
      console.error("AUTH TOKEN EXPIRED");
      return res.status(401).json({ msg: "Token expired" });
    }

    // 🔥 INVALID TOKEN
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ msg: "Invalid token" });
    }

    return res.status(401).json({
      msg: "Authorization failed",
    });
  }
};

export default auth;