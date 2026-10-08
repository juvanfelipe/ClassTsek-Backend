const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    units: {
      type: Number,
      default: 1,
      min: 0,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "Active",
        "Archived",
      ],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

const learningAreaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    department: {
      type: String,
      enum: [
        "Junior High School",
        "Senior High School",
      ],
      required: true,
    },

    description: {
      type: String,
      default: "",
    },

    subjects: {
      type: [subjectSchema],
      default: [],
    },

    status: {
      type: String,
      enum: [
        "Active",
        "Archived",
      ],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "LearningArea",
  learningAreaSchema
);