const express = require("express");

const router = express.Router();

const Announcement = require("../models/Announcement");


// ======================================================
// GET ALL
// ======================================================

router.get("/", async (req, res) => {
  try {
    const announcements =
      await Announcement.find()
        .sort({ createdAt: -1 });

    res.json(announcements);

  } catch (error) {
    console.error(
      "GET ANNOUNCEMENTS ERROR:",
      error
    );

    res.status(500).json({
      message: error.message,
    });
  }
});


// ======================================================
// CREATE
// ======================================================

router.post("/", async (req, res) => {
  try {
    const announcement =
      new Announcement(req.body);

    await announcement.save();

    res.status(201).json(
      announcement
    );

  } catch (error) {
    console.error(
      "CREATE ANNOUNCEMENT ERROR:",
      error
    );

    res.status(500).json({
      message: error.message,
    });
  }
});


// ======================================================
// UPDATE
// ======================================================

router.put("/:id", async (req, res) => {
  try {
    const updated =
      await Announcement.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
        }
      );

    res.json(updated);

  } catch (error) {
    console.error(
      "UPDATE ANNOUNCEMENT ERROR:",
      error
    );

    res.status(500).json({
      message: error.message,
    });
  }
});


// ======================================================
// DELETE
// ======================================================

router.delete("/:id", async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(
      req.params.id
    );

    res.json({
      message:
        "Announcement Deleted",
    });

  } catch (error) {
    console.error(
      "DELETE ANNOUNCEMENT ERROR:",
      error
    );

    res.status(500).json({
      message: error.message,
    });
  }
});


module.exports = router;