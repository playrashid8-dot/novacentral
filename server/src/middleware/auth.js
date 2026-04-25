import jwt from "jsonwebtoken";
import User from "../models/User.js";

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    // ❌ NO HEADER
    if (!header) {
      return res.status(401).json({ msg: "No token, authorization denied" });
    }

    // ❌ INVALID FORMAT
    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ msg: "Invalid token format" });
    }

    const token = header.split(" ")[1];

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
      id: user._id,
      vipLevel: user.vipLevel,
    };

    next();

  } catch (err) {
    console.error("AUTH ERROR:", err.message);

    // 🔥 TOKEN EXPIRED
    if (err.name === "TokenExpiredError") {
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