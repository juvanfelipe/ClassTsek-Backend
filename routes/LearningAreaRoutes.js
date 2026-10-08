const express = require("express");
const router = express.Router();

const LearningArea =
  require("../models/LearningArea");

/* ================= GET ALL ================= */

router.get("/", async (req, res) => {
  try {
    const data = await LearningArea.find()
      .sort({ name: 1 });

    res.json(data);
  } catch (err) {
    console.error("LEARNING AREA GET ERROR:", err);

    res.status(500).json({
      message: err.message,
    });
  }
});

/* ================= CREATE LEARNING AREA ================= */

router.post("/", async (req, res) => {
  try {
    const {
      name,
      department,
      description,
      status,
    } = req.body;

    const area = new LearningArea({
      name,
      department,
      description: description || "",
      status: status || "Active",
      subjects: [],
    });

    await area.save();

    res.status(201).json(area);
  } catch (err) {
    console.error("LEARNING AREA CREATE ERROR:", err);

    res.status(500).json({
      message: err.message,
    });
  }
});

/* ================= UPDATE LEARNING AREA ================= */

router.put("/:id", async (req, res) => {
  try {
    const {
      name,
      department,
      description,
      status,
    } = req.body;

    const data =
      await LearningArea.findByIdAndUpdate(
        req.params.id,
        {
          name,
          department,
          description: description || "",
          status,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!data) {
      return res.status(404).json({
        message: "Learning area not found.",
      });
    }

    res.json(data);
  } catch (err) {
    console.error("LEARNING AREA UPDATE ERROR:", err);

    res.status(500).json({
      message: err.message,
    });
  }
});

/* ================= CHANGE STATUS ================= */

router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    const area =
      await LearningArea.findByIdAndUpdate(
        req.params.id,
        { status },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!area) {
      return res.status(404).json({
        message: "Learning area not found.",
      });
    }

    res.json(area);
  } catch (err) {
    console.error(
      "LEARNING AREA STATUS ERROR:",
      err
    );

    res.status(500).json({
      message: err.message,
    });
  }
});

/* ================================================= */
/* ================= SUBJECTS ====================== */
/* ================================================= */

/* ================= GET SUBJECTS ================= */

router.get("/:id/subjects", async (req, res) => {
  try {
    const area =
      await LearningArea.findById(
        req.params.id
      );

    if (!area) {
      return res.status(404).json({
        message: "Learning area not found.",
      });
    }

    res.json(area.subjects || []);
  } catch (err) {
    console.error(
      "LEARNING AREA SUBJECT GET ERROR:",
      err
    );

    res.status(500).json({
      message: err.message,
    });
  }
});

/* ================= CREATE SUBJECT ================= */

router.post("/:id/subjects", async (req, res) => {
  try {
    const {
      name,
      code,
      units,
      description,
      status,
    } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        message:
          "Subject name and subject code are required.",
      });
    }

    const area =
      await LearningArea.findById(
        req.params.id
      );

    if (!area) {
      return res.status(404).json({
        message: "Learning area not found.",
      });
    }

    /*
      Prevent duplicate subject codes
      inside the same learning area.
    */

    const duplicate =
      area.subjects.some(
        (subject) =>
          subject.code.toLowerCase() ===
          code.trim().toLowerCase()
      );

    if (duplicate) {
      return res.status(400).json({
        message:
          "A subject with this code already exists in this learning area.",
      });
    }

    area.subjects.push({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      units:
        units === undefined
          ? 1
          : Number(units),
      description:
        description || "",
      status:
        status || "Active",
    });

    await area.save();

    const newSubject =
      area.subjects[
        area.subjects.length - 1
      ];

    res.status(201).json(newSubject);
  } catch (err) {
    console.error(
      "SUBJECT CREATE ERROR:",
      err
    );

    res.status(500).json({
      message: err.message,
    });
  }
});

/* ================= UPDATE SUBJECT ================= */

router.put(
  "/:id/subjects/:subjectId",
  async (req, res) => {
    try {
      const {
        name,
        code,
        units,
        description,
        status,
      } = req.body;

      const area =
        await LearningArea.findById(
          req.params.id
        );

      if (!area) {
        return res.status(404).json({
          message: "Learning area not found.",
        });
      }

      const subject =
        area.subjects.id(
          req.params.subjectId
        );

      if (!subject) {
        return res.status(404).json({
          message: "Subject not found.",
        });
      }

      /*
        Check duplicate code while
        ignoring the subject being edited.
      */

      const duplicate =
        area.subjects.some(
          (item) =>
            String(item._id) !==
              String(subject._id) &&
            item.code.toLowerCase() ===
              code.trim().toLowerCase()
        );

      if (duplicate) {
        return res.status(400).json({
          message:
            "A subject with this code already exists in this learning area.",
        });
      }

      subject.name =
        name.trim();

      subject.code =
        code.trim().toUpperCase();

      subject.units =
        units === undefined
          ? 1
          : Number(units);

      subject.description =
        description || "";

      subject.status =
        status || "Active";

      await area.save();

      res.json(subject);
    } catch (err) {
      console.error(
        "SUBJECT UPDATE ERROR:",
        err
      );

      res.status(500).json({
        message: err.message,
      });
    }
  }
);

/* ================= SUBJECT STATUS ================= */

router.patch(
  "/:id/subjects/:subjectId/status",
  async (req, res) => {
    try {
      const { status } = req.body;

      const area =
        await LearningArea.findById(
          req.params.id
        );

      if (!area) {
        return res.status(404).json({
          message:
            "Learning area not found.",
        });
      }

      const subject =
        area.subjects.id(
          req.params.subjectId
        );

      if (!subject) {
        return res.status(404).json({
          message:
            "Subject not found.",
        });
      }

      subject.status = status;

      await area.save();

      res.json(subject);
    } catch (err) {
      console.error(
        "SUBJECT STATUS ERROR:",
        err
      );

      res.status(500).json({
        message: err.message,
      });
    }
  }
);

module.exports = router;