import jwt from "jsonwebtoken";

const auth = (req, res, next) => {
  try {
    const header = req.headers.authorization;

    // ❌ NO TOKEN
    if (!header) {
      return res.status(401).json({ msg: "No token, authorization denied" });
    }

    // ❌ WRONG FORMAT
    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ msg: "Invalid token format" });
    }

    const token = header.split(" ")[1];

    // ❌ EMPTY TOKEN
    if (!token) {
      return res.status(401).json({ msg: "Token missing" });
    }

    // 🔐 VERIFY
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ IMPORTANT FIX
    req.user = {
      id: decoded.id,
    };

    next();

  } catch (err) {
    console.log("Auth Error:", err.message);

    return res.status(401).json({
      msg: "Token is not valid",
    });
  }
};

export default auth;