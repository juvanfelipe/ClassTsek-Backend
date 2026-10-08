const express = require("express");
const router = express.Router();

const CurriculumSubject =
  require("../models/CurriculumSubject");

/* ================= GET ALL ================= */
router.get("/", async (req, res) => {
  try {
    console.log("GET /api/curriculum-subjects called");

    const data = await CurriculumSubject.find()
      .populate("curriculum")
      .populate("learningArea");

    console.log("SUCCESS:", data.length);

    res.json(data);
  } catch (err) {
    console.error("❌ CURRICULUM SUBJECT ERROR:");
    console.error(err);

    res.status(500).json({
      message: err.message,
      stack: err.stack,
    });
  }
});

/* ================= CREATE ================= */
router.post("/", async (req, res) => {
  try {
    const subject =
      new CurriculumSubject(req.body);

    await subject.save();

    res.status(201).json(subject);
  } catch (err) {
  console.log("SUBJECT ERROR:");
  console.log(err);

  res.status(500).json({
    message: err.message,
  });
}
});

/* ================= UPDATE ================= */
router.put("/:id", async (req, res) => {
  try {
    const data =
      await CurriculumSubject.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
        }
      );

    res.json(data);
  } catch (err) {
  console.log("SUBJECT CREATE ERROR");
  console.log(err);

  res.status(500).json({
    message: err.message,
    error: err,
  });
}
});

/* ================= CHANGE STATUS ================= */
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    const subject =
      await CurriculumSubject.findByIdAndUpdate(
        req.params.id,
        { status },
        {
          new: true,
        }
      );

    res.json(subject);
  } catch (err) {
  console.log("SUBJECT CREATE ERROR");
  console.log(err);

  res.status(500).json({
    message: err.message,
    error: err,
  });
}
});

module.exports = router;