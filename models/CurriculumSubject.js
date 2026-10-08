const mongoose = require("mongoose");

const curriculumSubjectSchema =
  new mongoose.Schema(
    {
      curriculum: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Curriculum",
        required: true,
      },

      gradeLevel: {
        type: String,
        required: true,
      },

      learningArea: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "LearningArea",
        required: true,
      },

      /*
        References the subject _id stored
        inside the LearningArea subjects array.
      */

      subjectId: {
        type:
          mongoose.Schema.Types.ObjectId,
        required: false,
      },

      /*
        These are kept for compatibility
        with your existing enrollment system.
      */

      subjectCode: {
        type: String,
        required: true,
      },

      subjectName: {
        type: String,
        required: true,
      },

      description: {
        type: String,
        default: "",
      },

      units: {
        type: Number,
        default: 1,
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

module.exports =
  mongoose.model(
    "CurriculumSubject",
    curriculumSubjectSchema
  );