const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$%&!]).{8,20}$/;

const emailRegex =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const phoneRegex =
  /^\d{11}$/;

// =================================================
// GET ALL USERS
// =================================================
router.get("/", async (req, res) => {
  try {
    const users = await User.find()
      .select("-password +faceSamples");

    res.json(users);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// =================================================
// GET SINGLE USER
// =================================================
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password +faceSamples")
      .populate(
        "children",
        "firstName lastName schoolId gradeLevel section profileImage"
      );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// =================================================
// CREATE USER
// =================================================
router.post("/", async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      schoolId,
      email,
      phoneNumber,
      address,
      gender,
      birthDate,
      gradeLevel,
      section,
      department,
      subject,
      profileImage,
      role,
      password,
      status,
      children,
    } = req.body;

    // REQUIRED CHECK
    if (!firstName || !lastName || !schoolId || !password) {
      return res.status(400).json({
        message:
          "First Name, Last Name, School ID, and Password are required",
      });
    }

    // CHECK DUPLICATE SCHOOL ID
    const existingUser = await User.findOne({ schoolId });

    if (existingUser) {
      return res.status(400).json({
        message: "School ID already exists",
      });
    }

    // PASSWORD
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must contain uppercase, lowercase, number and special character.",
      });
    }

    // EMAIL
    if (email && !emailRegex.test(email)) {
      return res.status(400).json({
        message: "Invalid email format",
      });
    }

    // PHONE
    if (phoneNumber && !phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        message: "Phone number must be 11 digits",
      });
    }

    // HASH PASSWORD
    const hashedPassword = await bcrypt.hash(password, 10);

    // FULL NAME
    const fullName =
      `${firstName} ${middleName || ""} ${lastName}`.trim();

    // CREATE USER
    const user = new User({
      firstName,
      middleName: middleName || "",
      lastName,
      fullName,
      schoolId,
      email: email || "",
      phoneNumber: phoneNumber || "",
      address: address || "",
      gender: gender || "",
      birthDate: birthDate || "",
      gradeLevel: gradeLevel || "",
      section: section || "",
      department: department || "",
      subject: subject || "",
      profileImage: profileImage || "",
      role: role || "student",
      password: hashedPassword,
      status: status || "active",
      children: Array.isArray(children) ? children : [],
    });

    await user.save();

    res.status(201).json({
      message: "User created successfully",
      user,
    });
  } catch (error) {
    console.error("CREATE USER ERROR:", error);

    res.status(500).json({
      message: error.message || "Server Error",
    });
  }
});

// =================================================
// UPDATE USER
// =================================================
router.put("/:id", async (req, res) => {
  try {
    console.log("========== UPDATE USER ==========");
    console.log("USER ID:", req.params.id);
    console.log("ROLE:", req.body.role);
    console.log("CHILDREN:", req.body.children);
    console.log("PASSWORD PROVIDED:", !!req.body.password);
    console.log(
      "PASSWORD LENGTH:",
      req.body.password?.length || 0
    );

    const {
      firstName,
      middleName,
      lastName,
      schoolId,
      email,
      phoneNumber,
      address,
      gender,
      birthDate,
      gradeLevel,
      section,
      department,
      subject,
      profileImage,
      role,
      status,
      children,
      password,
    } = req.body;

    // -----------------------------------------
    // BASIC VALIDATION
    // -----------------------------------------
    if (!firstName || !lastName || !schoolId) {
      return res.status(400).json({
        message:
          "First Name, Last Name, and School ID are required",
      });
    }

    if (email && !emailRegex.test(email)) {
      return res.status(400).json({
        message: "Invalid email format",
      });
    }

    if (phoneNumber && !phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        message: "Phone number must be 11 digits",
      });
    }

    // -----------------------------------------
    // UPDATE ONLY NORMAL USER DATA
    // -----------------------------------------
    const updatedData = {
      firstName,
      middleName: middleName || "",
      lastName,

      fullName:
        `${firstName || ""} ${middleName || ""} ${lastName || ""}`.trim(),

      schoolId,
      email: email || "",
      phoneNumber: phoneNumber || "",
      address: address || "",
      gender: gender || "",
      birthDate: birthDate || "",
      gradeLevel: gradeLevel || "",
      section: section || "",
      department: department || "",
      subject: subject || "",

      role,
      status,

      children: Array.isArray(children)
        ? children
        : [],
    };

    // -----------------------------------------
    // PROFILE IMAGE
    // -----------------------------------------
    if (profileImage !== undefined) {
      updatedData.profileImage = profileImage;
    }

    // -----------------------------------------
    // PASSWORD
    // ONLY CHANGE PASSWORD IF A NEW PASSWORD
    // WAS ACTUALLY PROVIDED
    // -----------------------------------------
    if (password && password.trim() !== "") {
      const newPassword = password.trim();

      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({
          message:
            "Password must contain uppercase, lowercase, number and special character.",
        });
      }

      updatedData.password =
        await bcrypt.hash(newPassword, 10);

      console.log("PASSWORD WAS UPDATED");
    } else {
      console.log(
        "PASSWORD WAS NOT UPDATED - EXISTING PASSWORD PRESERVED"
      );
    }

    // -----------------------------------------
    // UPDATE DATABASE
    // -----------------------------------------
    const updatedUser =
      await User.findByIdAndUpdate(
        req.params.id,
        updatedData,
        {
          new: true,
          runValidators: true,
        }
      );

    if (!updatedUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    console.log("USER UPDATED SUCCESSFULLY");

    res.json(updatedUser);
  } catch (error) {
    console.error("UPDATE USER ERROR:", error);

    res.status(500).json({
      message: error.message || "Server Error",
    });
  }
});

// =================================================
// TOGGLE USER STATUS
// =================================================
router.patch("/:id/status", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Toggle status
    user.status =
      user.status === "active"
        ? "inactive"
        : "active";

    await user.save();

    // =================================================
    // STUDENT ↔ PARENT/GUARDIAN SYNC
    // =================================================
    if (user.role === "student") {
      await User.updateMany(
        {
          children: user._id,
        },
        {
          status: user.status,
        }
      );
    }

    res.json(user);
  } catch (error) {
    console.error("STATUS UPDATE ERROR:", error);

    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;