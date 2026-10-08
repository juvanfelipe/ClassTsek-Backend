const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Schedule = require("../models/Schedule");
const CurriculumSubject = require("../models/CurriculumSubject");
const Enrollment = require("../models/Enrollment");

const getId = (value) => {
  if (!value) return "";

  if (typeof value === "object" && value._id) {
    return String(value._id);
  }

  return String(value);
};

const sameValue = (a, b) => {
  return String(a || "").trim().toLowerCase() ===
    String(b || "").trim().toLowerCase();
};

// =================================================
// GET ALL SCHEDULES
// =================================================

router.get("/", async (req, res) => {
  try {
    const schedules = await Schedule.find()
      .populate(
        "curriculumSubject",
        "subjectCode subjectName gradeLevel curriculum learningArea"
      )
      .populate(
        "faculty",
        "firstName middleName lastName fullName schoolId"
      );

    res.json(schedules);
  } catch (error) {
    console.error("GET SCHEDULES ERROR:", error);

    res.status(500).json({
      message: error.message,
    });
  }
});

// =================================================
// FACULTY SCHEDULES
// =================================================

router.get("/faculty/:facultyId", async (req, res) => {
  try {
    const schedules = await Schedule.find({
      faculty: req.params.facultyId,
    })
      .populate(
        "curriculumSubject",
        "subjectCode subjectName gradeLevel curriculum learningArea"
      )
      .populate(
        "faculty",
        "firstName middleName lastName fullName schoolId"
      );

    res.json(schedules);
  } catch (error) {
    console.error("GET FACULTY SCHEDULES ERROR:", error);

    res.status(500).json({
      message: error.message,
    });
  }
});

// =================================================
// FACULTY STUDENTS
// =================================================

router.get("/faculty/:facultyId/students", async (req, res) => {
  try {
    const facultySchedules = await Schedule.find({
      faculty: req.params.facultyId,
    }).lean();

    if (!facultySchedules.length) {
      return res.json([]);
    }

    const students = await Enrollment.find({
      status: "Enrolled",
    })
      .populate(
        "student",
        "firstName middleName lastName fullName schoolId gradeLevel section profileImage"
      )
      .lean();

    const result = [];

    for (const enrollment of students) {
      const student = enrollment.student;

      if (!student) continue;

      const matchingSchedule = facultySchedules.find((schedule) => {
        return (
          sameValue(
            getId(schedule.academicYear),
            getId(enrollment.academicYear)
          ) &&
          sameValue(
            getId(schedule.semester),
            getId(enrollment.semester)
          ) &&
          sameValue(
            schedule.gradeLevel,
            enrollment.gradeLevel
          ) &&
          sameValue(
            schedule.section,
            enrollment.section
          )
        );
      });

      if (matchingSchedule) {
        result.push({
          ...student,
          enrollmentId: enrollment._id,
          academicYear: enrollment.academicYear,
          semester: enrollment.semester,
          curriculum: enrollment.curriculum,
          gradeLevel: enrollment.gradeLevel,
          section: enrollment.section,
          status: enrollment.status,
        });
      }
    }

    res.json(result);
  } catch (error) {
    console.error("GET FACULTY STUDENTS ERROR:", error);

    res.status(500).json({
      message: error.message,
    });
  }
});

// =================================================
// STUDENT SCHEDULES
// =================================================

router.get("/student/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;

    console.log("====================================");
    console.log("STUDENT SCHEDULE REQUEST");
    console.log("Student:", studentId);

    // Prevent invalid MongoDB IDs from causing a 500
    if (!mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({
        message: "Invalid student ID",
      });
    }

    // -------------------------------------------------
    // Get the student's enrollment.
    //
    // IMPORTANT:
    // Do NOT populate academicYear or semester here.
    // Some existing records contain values such as
    // "2026-2027", and populating them as ObjectIds
    // causes the CastError you are seeing.
    // -------------------------------------------------

    const enrollments = await Enrollment.find({
      student: studentId,
      status: "Enrolled",
    }).lean();

    console.log("Student enrollments:", enrollments.length);

    if (!enrollments.length) {
      console.log("No enrolled record found.");
      console.log("====================================");

      return res.json([]);
    }

    // -------------------------------------------------
    // Get schedules.
    //
    // Do NOT populate academicYear or semester.
    // The Android parent schedule does not need them.
    // -------------------------------------------------

    const schedules = await Schedule.find()
      .populate(
        "curriculumSubject",
        "subjectCode subjectName gradeLevel curriculum learningArea"
      )
      .populate(
        "faculty",
        "firstName middleName lastName fullName schoolId"
      )
      .lean();

    console.log("Total schedules:", schedules.length);

    const result = [];

    for (const schedule of schedules) {
      const scheduleGradeLevel =
        schedule.gradeLevel ||
        schedule.curriculumSubject?.gradeLevel ||
        "";

      const scheduleSection =
        schedule.section || "";

      for (const enrollment of enrollments) {
        const sameAcademicYear = sameValue(
          getId(schedule.academicYear),
          getId(enrollment.academicYear)
        );

        const sameSemester = sameValue(
          getId(schedule.semester),
          getId(enrollment.semester)
        );

        const sameGrade = sameValue(
          scheduleGradeLevel,
          enrollment.gradeLevel
        );

        const sameSection = sameValue(
          scheduleSection,
          enrollment.section
        );

        console.log(
          "MATCH:",
          schedule.subject,
          "| year:",
          sameAcademicYear,
          "| semester:",
          sameSemester,
          "| grade:",
          sameGrade,
          "| section:",
          sameSection
        );

        if (
          sameAcademicYear &&
          sameSemester &&
          sameGrade &&
          sameSection
        ) {
          result.push(schedule);
          break;
        }
      }
    }

    console.log("Student schedules returned:", result.length);
    console.log("====================================");

    res.json(result);
  } catch (error) {
    console.error("====================================");
    console.error("STUDENT SCHEDULE ERROR:", error);
    console.error("====================================");

    res.status(500).json({
      message: error.message || "Failed to load student schedule",
    });
  }
});

// =================================================
// GET ONE SCHEDULE
// =================================================

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid schedule ID",
      });
    }

    const schedule = await Schedule.findById(req.params.id)
      .populate(
        "curriculumSubject",
        "subjectCode subjectName gradeLevel curriculum learningArea"
      )
      .populate(
        "faculty",
        "firstName middleName lastName fullName schoolId"
      );

    if (!schedule) {
      return res.status(404).json({
        message: "Schedule not found",
      });
    }

    res.json(schedule);
  } catch (error) {
    console.error("GET SCHEDULE ERROR:", error);

    res.status(500).json({
      message: error.message,
    });
  }
});

// =================================================
// CREATE SCHEDULE
// =================================================

router.post("/", async (req, res) => {
  try {
    const {
      curriculumSubject,
      faculty,
      room,
      days,
      startTime,
      endTime,
      section,
      course,
      yearLevel,
      department,
      gradeLevel,
      academicYear,
      semester,
      capacity,
    } = req.body;

    if (
      !curriculumSubject ||
      !faculty ||
      !room ||
      !days ||
      !startTime ||
      !endTime ||
      !section ||
      !academicYear ||
      !semester
    ) {
      return res.status(400).json({
        message:
          "curriculumSubject, faculty, room, days, startTime, endTime, section, academicYear and semester are required",
      });
    }

    const subjectData =
      await CurriculumSubject.findById(curriculumSubject).lean();

    if (!subjectData) {
      return res.status(404).json({
        message: "Curriculum subject not found",
      });
    }

    const subjectName =
      subjectData.subjectName ||
      subjectData.name ||
      subjectData.subject ||
      "";

    const subjectCode =
      subjectData.subjectCode ||
      subjectData.code ||
      "";

    const finalGradeLevel =
      gradeLevel ||
      subjectData.gradeLevel ||
      "";

    const duplicate = await Schedule.findOne({
      faculty,
      days,
      startTime,
      endTime,
      section,
      academicYear,
      semester,
    });

    if (duplicate) {
      return res.status(400).json({
        message:
          "A schedule with the same faculty, day, time, section, academic year and semester already exists.",
      });
    }

    const schedule = await Schedule.create({
      curriculumSubject,
      subject: subjectName,
      subjectCode,
      faculty,
      room,
      days,
      startTime,
      endTime,
      section,
      course: course || "",
      yearLevel: yearLevel || "",
      department: department || "",
      gradeLevel: finalGradeLevel,
      academicYear,
      semester,
      capacity: capacity || 40,
    });

    const populated = await Schedule.findById(schedule._id)
      .populate(
        "curriculumSubject",
        "subjectCode subjectName gradeLevel curriculum learningArea"
      )
      .populate(
        "faculty",
        "firstName middleName lastName fullName schoolId"
      );

    res.status(201).json(populated);
  } catch (error) {
    console.error("CREATE SCHEDULE ERROR:", error);

    res.status(500).json({
      message: error.message,
    });
  }
});

// =================================================
// UPDATE SCHEDULE
// =================================================

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid schedule ID",
      });
    }

    const {
      curriculumSubject,
      faculty,
      room,
      days,
      startTime,
      endTime,
      section,
      course,
      yearLevel,
      department,
      gradeLevel,
      academicYear,
      semester,
      capacity,
    } = req.body;

    if (
      !curriculumSubject ||
      !faculty ||
      !room ||
      !days ||
      !startTime ||
      !endTime ||
      !section ||
      !academicYear ||
      !semester
    ) {
      return res.status(400).json({
        message:
          "curriculumSubject, faculty, room, days, startTime, endTime, section, academicYear and semester are required",
      });
    }

    const subjectData =
      await CurriculumSubject.findById(curriculumSubject).lean();

    if (!subjectData) {
      return res.status(404).json({
        message: "Curriculum subject not found",
      });
    }

    const subjectName =
      subjectData.subjectName ||
      subjectData.name ||
      subjectData.subject ||
      "";

    const subjectCode =
      subjectData.subjectCode ||
      subjectData.code ||
      "";

    const finalGradeLevel =
      gradeLevel ||
      subjectData.gradeLevel ||
      "";

    const duplicate = await Schedule.findOne({
      _id: { $ne: req.params.id },
      faculty,
      days,
      startTime,
      endTime,
      section,
      academicYear,
      semester,
    });

    if (duplicate) {
      return res.status(400).json({
        message:
          "A schedule with the same faculty, day, time, section, academic year and semester already exists.",
      });
    }

    const updated = await Schedule.findByIdAndUpdate(
      req.params.id,
      {
        curriculumSubject,
        subject: subjectName,
        subjectCode,
        faculty,
        room,
        days,
        startTime,
        endTime,
        section,
        course: course || "",
        yearLevel: yearLevel || "",
        department: department || "",
        gradeLevel: finalGradeLevel,
        academicYear,
        semester,
        capacity: capacity || 40,
      },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate(
        "curriculumSubject",
        "subjectCode subjectName gradeLevel curriculum learningArea"
      )
      .populate(
        "faculty",
        "firstName middleName lastName fullName schoolId"
      );

    if (!updated) {
      return res.status(404).json({
        message: "Schedule not found",
      });
    }

    res.json(updated);
  } catch (error) {
    console.error("UPDATE SCHEDULE ERROR:", error);

    res.status(500).json({
      message: error.message,
    });
  }
});

// =================================================
// DELETE SCHEDULE
// =================================================

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid schedule ID",
      });
    }

    const deleted =
      await Schedule.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        message: "Schedule not found",
      });
    }

    res.json({
      message: "Schedule deleted successfully",
    });
  } catch (error) {
    console.error("DELETE SCHEDULE ERROR:", error);

    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;