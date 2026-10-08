const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },

    middleName: {
      type: String,
      default: "",
    },

    lastName: {
      type: String,
      required: true,
    },

    fullName: {
      type: String,
      default: "",
    },

    schoolId: {
      type: String,
      required: true,
      unique: true,
    },

    email: {
      type: String,
      default: "",
    },

    phoneNumber: {
      type: String,
      default: "",
    },

    address: {
      type: String,
      default: "",
    },

    gender: {
      type: String,
      default: "",
    },

    birthDate: {
      type: String,
      default: "",
    },

    gradeLevel: {
      type: String,
      default: "",
    },

    section: {
      type: String,
      default: "",
    },

    department: {
      type: String,
      default: "",
    },

    curriculum: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Curriculum",
    },

    subject: {
      type: String,
      default: "",
    },

    profileImage: {
      type: String,
      default: "https://i.pravatar.cc/300",
    },

    
faceEnrollmentStatus: {
  type: String,
  enum: ["not-enrolled", "enrolled"],
  default: "not-enrolled",
},

faceSamples: {
  type: [
    {
      imagePath: {
        type: String,
        required: true,
      },
      source: {
        type: String,
        enum: ["camera", "upload"],
        required: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  default: [],
  select: false,
},

    role: {
  type: String,
  enum: [
    "student",
    "faculty",
    "admin",
    "parent",
    "guardian",
  ],
  default: "student",
},



status: {
  type: String,
  enum: ["active", "inactive"],
  default: "active",
},

children: [
  {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
],

    password: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);


module.exports = mongoose.model("User", userSchema);