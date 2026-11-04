const mongoose = require("mongoose");

const facultyActivityLogSchema = new mongoose.Schema(
  {
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

facultyActivityLogSchema.index({ faculty: 1, createdAt: -1 });

module.exports = mongoose.model(
  "FacultyActivityLog",
  facultyActivityLogSchema
);