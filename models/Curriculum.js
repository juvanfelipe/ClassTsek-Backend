const mongoose = require("mongoose");

const curriculumSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    department: {
      type: String,
      enum: [
        "Junior High School",
        "Senior High School",
      ],
      required: true,
    },

    effectiveYear: {
      type: Number,
      required: true,
    },

    expirationYear: {
      type: Number,
      default: null,
    },

    status: {
    type: String,
    enum: [
        "Draft",
        "Active",
        "Retired",
        "Archived",
    ],
    default: "Draft",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Curriculum",
  curriculumSchema
);