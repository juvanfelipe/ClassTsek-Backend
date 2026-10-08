const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

    curriculum: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Curriculum",
      required: true,
    },

    gradeLevel: {
      type: String,
      required: true,
    },

    section: {
      type: String,
      default: "Unassigned",
    },

    status: {
      type: String,
      enum: ["Pending", "Enrolled", "Dropped", "Graduated"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Enrollment", enrollmentSchema);