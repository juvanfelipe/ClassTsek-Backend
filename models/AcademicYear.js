const mongoose = require("mongoose");

const academicYearSchema =
new mongoose.Schema(
{
  year: {
    type: String,
    required: true,
    unique: true,
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
  "AcademicYear",
  academicYearSchema
);