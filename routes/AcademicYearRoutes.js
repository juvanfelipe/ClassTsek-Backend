const express = require("express");
const router = express.Router();

const AcademicYear =
  require("../models/AcademicYear");

/* GET ALL */
router.get("/", async (req, res) => {
  const data = await AcademicYear.find();
  res.json(data);
});

/* CREATE */
router.post("/", async (req, res) => {
  try {
    const year =
      new AcademicYear(req.body);

    await year.save();

    res.status(201).json(year);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

/* UPDATE */
router.put("/:id", async (req, res) => {
  try {
    const data =
      await AcademicYear.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
        }
      );

    res.json(data);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

/* CHANGE STATUS */
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    const year =
      await AcademicYear.findByIdAndUpdate(
        req.params.id,
        { status },
        {
          new: true,
        }
      );

    res.json(year);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

module.exports = router;