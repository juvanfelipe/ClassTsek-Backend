const express = require("express");
const router = express.Router();

const Subject = require("../models/Subject");

/* ================= GET ALL ================= */
router.get("/", async (req, res) => {
  try {
    const subjects = await Subject.find().sort({
      gradeLevel: 1,
      subjectName: 1,
    });

    res.json(subjects);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

/* ================= CREATE ================= */
router.post("/", async (req, res) => {
  try {
    const subject = await Subject.create(req.body);
    res.status(201).json(subject);
  } catch (err) {
    res.status(400).json({
      message: err.message,
    });
  }
});

/* ================= UPDATE ================= */
router.put("/:id", async (req, res) => {
  try {
    const subject = await Subject.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
      }
    );

    res.json(subject);
  } catch (err) {
    res.status(400).json({
      message: err.message,
    });
  }
});

/* ================= STATUS ================= */
router.patch("/:id/status", async (req, res) => {
  try {
    const subject = await Subject.findByIdAndUpdate(
      req.params.id,
      {
        status: req.body.status,
      },
      {
        new: true,
      }
    );

    res.json(subject);
  } catch (err) {
    res.status(400).json({
      message: err.message,
    });
  }
});

module.exports = router;