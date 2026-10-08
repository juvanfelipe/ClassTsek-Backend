const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema(
  {
    curriculumSubject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CurriculumSubject",
      required: true,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
    },

    subjectCode: {
      type: String,
      default: "",
      trim: true,
    },

    section: {
      type: String,
      required: true,
      trim: true,
    },

    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    room: {
      type: String,
      required: true,
      trim: true,
    },

    days: {
      type: String,
      required: true,
      trim: true,
    },

    startTime: {
      type: String,
      required: true,
    },

    endTime: {
      type: String,
      required: true,
    },

    course: {
      type: String,
      default: "",
    },

    yearLevel: {
      type: String,
      default: "",
    },

    department: {
      type: String,
      default: "",
    },

    gradeLevel: {
      type: String,
      default: "",
    },

    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicYear",
      required: true,
    },

    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Semester",
      required: true,
    },

    capacity: {
      type: Number,
      default: 40,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Schedule", scheduleSchema);