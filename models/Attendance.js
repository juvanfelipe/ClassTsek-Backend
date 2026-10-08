const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Schedule",
      required: true,
    },

    status: {
      type: String,
      enum: ["Present", "Late", "Absent", "Excused"],
      default: "Present",
    },

    excuseType: {
      type: String,
      default: "",
    },

    timeIn: {
      type: String,
      default: "",
    },

    timeOut: {
      type: String,
      default: "",
    },

    date: {
      type: String,
      default: () => new Date().toLocaleDateString(),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Attendance", attendanceSchema);