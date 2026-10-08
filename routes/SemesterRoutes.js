const express = require("express");
const router = express.Router();

const Semester =
  require("../models/Semester");

router.get("/", async (req, res) => {
  const data = await Semester.find();
  res.json(data);
});

router.post("/", async (req, res) => {
  try {
    const semester =
      new Semester(req.body);

    await semester.save();

    res.status(201).json(semester);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const data =
      await Semester.findByIdAndUpdate(
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

router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    const semester =
      await Semester.findByIdAndUpdate(
        req.params.id,
        { status },
        {
          new: true,
        }
      );

    res.json(semester);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

module.exports = router;