const mongoose = require("mongoose");

const semesterSchema =
new mongoose.Schema(
{
  academicYear: {
    type:
      mongoose.Schema.Types.ObjectId,
    ref: "AcademicYear",
    required: true,
  },

  name: {
    type: String,
    enum: [
      "1st Semester",
      "2nd Semester",
      "Summer",
    ],
    required: true,
  },

  startDate: {
    type: Date,
    required: true,
  },

  endDate: {
    type: Date,
    required: true,
  },

  status: {
  type: String,
  enum: [
    "Upcoming",
    "Active",
    "Completed",
    "Archived",
  ],
  default: "Upcoming",
},
},
{
  timestamps: true,
});

module.exports =
mongoose.model(
  "Semester",
  semesterSchema
);