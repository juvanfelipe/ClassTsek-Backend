const mongoose = require("mongoose");

const announcementSchema =
  new mongoose.Schema(
    {
      title: {
        type: String,
        required: true,
      },

      message: {
        type: String,
        required: true,
      },

      audience: {
        type: String,
        enum: [
          "all",
          "student",
          "faculty",
          "parent",
        ],
        default: "all",
      },

      priority: {
        type: String,
        enum: [
          "Normal",
          "Important",
          "Urgent",
        ],
        default: "Normal",
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "Announcement",
    announcementSchema
  );