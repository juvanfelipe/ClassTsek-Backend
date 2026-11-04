const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const FacultyActivityLog = require("../models/FacultyActivityLog");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Verify JWT and require faculty role
|--------------------------------------------------------------------------
*/
const verifyFacultyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authorization token is required.",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.id || decoded.role !== "faculty") {
      return res.status(403).json({
        message: "Faculty access only.",
      });
    }

    req.user = {
      id: decoded.id,
      role: decoded.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET FACULTY ACTIVITY LOGS
| GET /api/faculty-logs
|--------------------------------------------------------------------------
*/
router.get("/", verifyFacultyToken, async (req, res) => {
  try {
    const logs = await FacultyActivityLog.find({
      faculty: req.user.id,
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.json({
      logs,
    });
  } catch (error) {
    console.error("Get faculty logs error:", error);

    return res.status(500).json({
      message: "Unable to retrieve faculty activity logs.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| CREATE FACULTY ACTIVITY LOG
| POST /api/faculty-logs
|--------------------------------------------------------------------------
*/
router.post("/", verifyFacultyToken, async (req, res) => {
  try {
    const { action, description, details } = req.body;

    if (
      typeof action !== "string" ||
      !action.trim() ||
      typeof description !== "string" ||
      !description.trim()
    ) {
      return res.status(400).json({
        message: "Action and description are required.",
      });
    }

    const log = await FacultyActivityLog.create({
      // Always use the faculty ID from the verified JWT.
      // Do not accept faculty ID from the request body.
      faculty: req.user.id,
      action: action.trim().slice(0, 100),
      description: description.trim().slice(0, 500),
      details:
        details && typeof details === "object"
          ? details
          : {},
    });

    return res.status(201).json({
      message: "Activity recorded.",
      log,
    });
  } catch (error) {
    console.error("Create faculty log error:", error);

    return res.status(500).json({
      message: "Unable to record faculty activity.",
    });
  }
});

module.exports = router;