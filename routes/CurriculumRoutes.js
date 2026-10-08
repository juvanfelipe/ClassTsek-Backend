const express = require("express");
const router = express.Router();

const Curriculum = require("../models/Curriculum");

router.get("/", async (req, res) => {
  const data = await Curriculum.find();
  res.json(data);
});

router.post("/", async (req, res) => {
  try {
    const curriculum = new Curriculum(req.body);

    await curriculum.save();

    res.status(201).json(curriculum);
  } catch (err) {
  console.log("CURRICULUM ERROR:");
  console.log(err);

  res.status(500).json({
    message: err.message,
  });
}
});

router.put("/:id", async (req, res) => {
  try {
    const data =
      await Curriculum.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
        }
      );

    res.json(data);
  } catch (err) {
  console.log("CURRICULUM ERROR:");
  console.log(err);

  res.status(500).json({
    message: err.message,
  });
}
});

router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    const curriculum =
      await Curriculum.findByIdAndUpdate(
        req.params.id,
        { status },
        {
          new: true,
        }
      );

    res.json(curriculum);
  } catch (err) {
  console.log("CURRICULUM ERROR:");
  console.log(err);

  res.status(500).json({
    message: err.message,
  });
}
});

module.exports = router;