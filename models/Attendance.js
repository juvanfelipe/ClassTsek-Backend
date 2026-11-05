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

    excuseType: { type: String, default: "" },
    excuseReason: { type: String, default: "", maxlength: 1000 },
    excuseAttachment: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
      originalName: { type: String, default: "" },
      mimeType: { type: String, default: "" },
      size: { type: Number, default: 0 },
    },
    method: { type: String, enum: ["Manual", "Scanned", "Unknown"], default: "Unknown" },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

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