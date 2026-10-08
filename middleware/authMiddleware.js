
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    console.log("AUTH HEADER EXISTS:", !!authHeader);
    console.log(
      "AUTH HEADER FORMAT:",
      authHeader?.startsWith("Bearer ")
    );

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("AUTH ERROR: Missing or invalid Authorization header");

      return res.status(401).json({
        message: "Authentication token required.",
      });
    }

    const token = authHeader.split(" ")[1];

    console.log("TOKEN EXISTS:", !!token);

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    console.log("TOKEN VERIFIED");
    console.log("TOKEN USER ID:", decoded.id);

    const user = await User.findById(decoded.id).select(
      "_id role status"
    );

    console.log(
      "USER FOUND:",
      !!user,
      user
        ? {
            id: user._id.toString(),
            role: user.role,
            status: user.status,
          }
        : null
    );

    if (!user || user.status !== "active") {
      console.log("AUTH ERROR: User missing or inactive");

      return res.status(401).json({
        message: "Invalid or inactive account.",
      });
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
    };

    next();

  } catch (error) {
    console.log("JWT AUTH ERROR:", error.message);

    return res.status(401).json({
      message: "Invalid or expired authentication token.",
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      message: "Administrator access required.",
    });
  }

  next();
};

module.exports = {
  verifyToken,
  requireAdmin,
};