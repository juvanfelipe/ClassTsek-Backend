const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

/* ================= VALIDATIONS ================= */

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$%&!]).{8,20}$/;

const emailRegex =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const phoneRegex =
  /^\d{11}$/;

/* ================= REGISTER ================= */

router.post("/register", async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      schoolId,
      password,
      role,
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
      status,
      children,
    } = req.body;

    /* REQUIRED FIELDS */

    if (
      !firstName ||
      !lastName ||
      !schoolId ||
      !password
    ) {
      return res.status(400).json({
        message:
          "First Name, Last Name, School ID, Username and Password are required",
      });
    }

    /* USERNAME VALIDATION */


    /* PASSWORD VALIDATION */

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must contain uppercase, lowercase, number and special character.",
      });
    }

    /* EMAIL VALIDATION */

    if (
      email &&
      !emailRegex.test(email)
    ) {
      return res.status(400).json({
        message:
          "Invalid email format.",
      });
    }

    /* PHONE VALIDATION */

    if (
      phoneNumber &&
      !phoneRegex.test(phoneNumber)
    ) {
      return res.status(400).json({
        message:
          "Phone number must be exactly 11 digits.",
      });
    }

    /* CHECK DUPLICATE SCHOOL ID */

    const existingSchoolId =
      await User.findOne({
        schoolId,
      });

    if (existingSchoolId) {
      return res.status(400).json({
        message:
          "School ID already exists.",
      });
    }

    /* HASH PASSWORD */

    const hashedPassword =
      await bcrypt.hash(
        password,
        10
      );

    /* FULL NAME */

    const fullName =
      `${firstName} ${middleName || ""} ${lastName}`.trim();

    /* CREATE USER */

    const user = new User({
      firstName,
      middleName,
      lastName,
      fullName,
      schoolId,

      password:
        hashedPassword,

      role:
        role || "student",

      email:
        email || "",

      phoneNumber:
        phoneNumber || "",

      address:
        address || "",

      gender:
        gender || "",

      birthDate:
        birthDate || "",

      gradeLevel:
        gradeLevel || "",

      section:
        section || "",

      department:
        department || "",

      subject:
        subject || "",

      profileImage:
        profileImage ||
        "https://i.pravatar.cc/300",

      status:
        status || "active",

      children:
        children || [],
    });

    await user.save();

    res.status(201).json({
      message:
        "User created successfully",
      user,
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message:
        "Server error",
      error:
        error.message,
    });

  }
});

/* ================= LOGIN ================= */

router.post("/login", async (req, res) => {
  try {

    const {
      schoolId,
      password,
    } = req.body;

    const user =
      await User.findOne({
        schoolId,
      });

    if (!user) {
      return res.status(404).json({
        message:
          "User not found",
      });
    }

    /* BLOCK INACTIVE USERS */

    if (
      user.status ===
      "inactive"
    ) {
      return res.status(403).json({
        message:
          "Your account has been deactivated. Please contact the administrator.",
      });
    }

    const isMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!isMatch) {
      return res.status(400).json({
        message:
          "Invalid credentials",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    res.json({
      token,
      user,
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message:
        "Server error",
      error:
        error.message,
    });

  }
});

module.exports = router;