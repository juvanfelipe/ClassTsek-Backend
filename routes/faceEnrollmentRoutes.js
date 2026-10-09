const express = require("express");
require("dotenv").config();

const router = express.Router();

const multer = require("multer");

const path = require("path");

const fs = require("fs");

const sharp = require("sharp");

const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("FACE CLOUDINARY CONFIG:", {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key_exists: !!process.env.CLOUDINARY_API_KEY,
  api_secret_exists: !!process.env.CLOUDINARY_API_SECRET,
});

const User = require("../models/User");
const Schedule = require("../models/Schedule");
const Enrollment = require("../models/Enrollment");

const {
  verifyToken,
  requireAdmin,
} = require("../middleware/authMiddleware");

// =====================================================
// UPLOAD DIRECTORY
// =====================================================

const uploadDir = path.join(
  __dirname,
  "..",
  "uploads",
  "face-samples"
);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

// =====================================================
// GENERATE SIGNED CLOUDINARY FACE IMAGE URL
// =====================================================

function getCloudinaryFaceUrl(publicId) {
  if (!publicId) {
    return null;
  }

  return cloudinary.url(publicId, {
    resource_type: "image",
    type: "authenticated",
    secure: true,
    sign_url: true,
  });
}

// =====================================================
// MULTER
// =====================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname).toLowerCase();

    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error(
          "Only JPG and PNG images are allowed."
        )
      );
    }

    cb(null, true);
  },
});

// =====================================================
// POST FACE ENROLLMENT
// POST /api/face-enrollment/:schoolId
//
// ADMIN ONLY
// =====================================================

router.post(
  "/:schoolId",
  verifyToken,
  requireAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { source } = req.body;

      // -------------------------------------------------
      // Validate source
      // -------------------------------------------------

      if (
        source !== "camera" &&
        source !== "upload"
      ) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(400).json({
          message:
            'Source must be either "camera" or "upload".',
        });
      }

      // -------------------------------------------------
      // Validate image
      // -------------------------------------------------

      if (!req.file) {
        return res.status(400).json({
          message: "Face image is required.",
        });
      }

      // -------------------------------------------------
      // Validate image using Sharp
      // -------------------------------------------------

      let imageMetadata;

      try {
        imageMetadata =
          await sharp(req.file.path).metadata();
      } catch (error) {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(400).json({
          message:
            "Invalid or corrupted image.",
        });
      }

      // -------------------------------------------------
      // Minimum image size
      // -------------------------------------------------

      if (
        !imageMetadata.width ||
        !imageMetadata.height ||
        imageMetadata.width < 112 ||
        imageMetadata.height < 112
      ) {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(400).json({
          message:
            "Face image must be at least 112x112 pixels.",
        });
      }

      // -------------------------------------------------
      // Find student
      // -------------------------------------------------

      const student =
        await User.findOne({
          schoolId,
          role: "student",
        }).select("+faceSamples");

      if (!student) {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(404).json({
          message: "Student not found.",
        });
      }

      // -------------------------------------------------
      // Maximum of 5 samples
      // -------------------------------------------------

      if (
        student.faceSamples &&
        student.faceSamples.length >= 5
      ) {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(400).json({
          message:
            "Maximum of 5 face samples reached.",
        });
      }

      // -------------------------------------------------
      // Generate Cloudinary public ID
      // -------------------------------------------------

      const publicId =
        `classtsek/face-samples/${path.parse(
          req.file.filename
        ).name}`;

      // -------------------------------------------------
      // Upload temporary image to Cloudinary
      // -------------------------------------------------

      let cloudinaryResult;

      try {
        cloudinaryResult =
          await cloudinary.uploader.upload(
            req.file.path,
            {
              public_id: publicId,
              resource_type: "image",
              type: "authenticated",
              overwrite: true,
            }
          );
      } catch (cloudinaryError) {
        console.error(
          "CLOUDINARY FACE UPLOAD ERROR:",
          cloudinaryError
        );

        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(500).json({
          message:
            "Unable to upload face image to Cloudinary.",
        });
      }

      // -------------------------------------------------
      // Store relative path
      //
      // Keep this for legacy compatibility.
      // -------------------------------------------------

      const relativePath =
        path
          .relative(
            path.join(__dirname, ".."),
            req.file.path
          )
          .replace(/\\/g, "/");

      // -------------------------------------------------
      // Add face sample
      // -------------------------------------------------

      student.faceSamples.push({
        imagePath: relativePath,
        source,
        createdAt: new Date(),
        cloudinaryPublicId:
          cloudinaryResult.public_id,
        cloudinaryResourceType:
          cloudinaryResult.resource_type,
        cloudinaryType:
          cloudinaryResult.type,
      });

      student.faceEnrollmentStatus =
        "enrolled";

      await student.save();

      // -------------------------------------------------
      // Delete temporary local file
      // -------------------------------------------------

      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      // -------------------------------------------------
      // Success
      // -------------------------------------------------

      return res.status(201).json({
        message:
          "Face sample enrolled successfully.",
        faceEnrollmentStatus:
          student.faceEnrollmentStatus,
        sampleCount:
          student.faceSamples.length,
      });

    } catch (error) {
      console.error(
        "FACE ENROLLMENT ERROR:",
        error
      );

      if (
        req.file &&
        fs.existsSync(req.file.path)
      ) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(500).json({
        message:
          error.message ||
          "Unable to enroll face.",
      });
    }
  }
);

// =====================================================
// GET LATEST FACE SAMPLE
// GET /api/face-enrollment/:schoolId
//
// ADMIN:
//     Can view any student.
//
// STUDENT:
//     Can view own face only.
//
// PARENT/GUARDIAN:
//     Can view their child's face only.
//
// FACULTY:
//     Can view students belonging to their
//     assigned grade/section/schedule.
//
// IMPORTANT:
// This route requires authentication.
// It is NOT publicly accessible.
// =====================================================

router.get(
  "/:schoolId",
  verifyToken,

  async (req, res) => {
    try {
      const { schoolId } = req.params;
      const role = req.user.role;

      // -------------------------------------------------
      // Find requested student
      // -------------------------------------------------

      const student =
        await User.findOne({
          schoolId,
          role: "student",
          faceEnrollmentStatus: "enrolled",
        }).select("+faceSamples");

      if (!student) {
        return res.status(404).json({
          message:
            "Student or face enrollment not found.",
        });
      }

      // =================================================
      // ADMIN
      // =================================================

      if (role === "admin") {
        // Admin is allowed to view any student.
      }

      // =================================================
      // STUDENT
      // =================================================

      else if (role === "student") {
        const loggedInStudent =
          await User.findById(req.user.id)
            .select("_id schoolId role");

        if (
          !loggedInStudent ||
          loggedInStudent.role !== "student" ||
          loggedInStudent.schoolId !== schoolId
        ) {
          return res.status(403).json({
            message:
              "You are not allowed to view this face sample.",
          });
        }
      }

      // =================================================
      // PARENT / GUARDIAN
      // =================================================

      else if (
        role === "parent" ||
        role === "guardian"
      ) {
        const parent =
          await User.findById(req.user.id)
            .select("_id role children");

        if (!parent) {
          return res.status(403).json({
            message:
              "Parent or guardian account not found.",
          });
        }

        const isChild =
          parent.children &&
          parent.children.some(
            childId =>
              childId.toString() ===
              student._id.toString()
          );

        if (!isChild) {
          return res.status(403).json({
            message:
              "You are not allowed to view this student's face.",
          });
        }
      }

      // =================================================
      // FACULTY
      // =================================================

      else if (role === "faculty") {

        // -------------------------------------------------
        // Get schedules assigned to this faculty
        // -------------------------------------------------

        const schedules =
          await Schedule.find({
            faculty: req.user.id,
          }).select(
            "gradeLevel section academicYear semester"
          );

        if (
          !schedules ||
          schedules.length === 0
        ) {
          return res.status(403).json({
            message:
              "You do not have any assigned schedules.",
          });
        }

        // -------------------------------------------------
        // Get student's active enrollment
        // -------------------------------------------------

        const enrollments =
          await Enrollment.find({
            student: student._id,
            status: "Enrolled",
          }).select(
            "gradeLevel section academicYear semester"
          );

        if (
          !enrollments ||
          enrollments.length === 0
        ) {
          return res.status(403).json({
            message:
              "Student has no active enrollment.",
          });
        }

        // -------------------------------------------------
        // Match faculty schedule with student enrollment
        // -------------------------------------------------

        const allowed =
          enrollments.some(
            enrollment => {
              return schedules.some(
                schedule => {

                  const sameGrade =
                    String(
                      schedule.gradeLevel || ""
                    )
                      .trim()
                      .toLowerCase() ===
                    String(
                      enrollment.gradeLevel || ""
                    )
                      .trim()
                      .toLowerCase();

                  const sameSection =
                    String(
                      schedule.section || ""
                    )
                      .trim()
                      .toLowerCase() ===
                    String(
                      enrollment.section || ""
                    )
                      .trim()
                      .toLowerCase();

                  const sameAcademicYear =
                    schedule.academicYear &&
                    enrollment.academicYear &&
                    schedule.academicYear.toString() ===
                    enrollment.academicYear.toString();

                  const sameSemester =
                    schedule.semester &&
                    enrollment.semester &&
                    schedule.semester.toString() ===
                    enrollment.semester.toString();

                  return (
                    sameGrade &&
                    sameSection &&
                    sameAcademicYear &&
                    sameSemester
                  );
                }
              );
            }
          );

        if (!allowed) {
          return res.status(403).json({
            message:
              "You are not allowed to view this student's face.",
          });
        }
      }

      // =================================================
      // UNKNOWN ROLE
      // =================================================

      else {
        return res.status(403).json({
          message:
            "Access denied.",
        });
      }

      // =================================================
      // CHECK FACE SAMPLES
      // =================================================

      if (
        !student.faceSamples ||
        student.faceSamples.length === 0
      ) {
        return res.status(404).json({
          message:
            "No face sample found.",
        });
      }

      // =================================================
      // GET LATEST SAMPLE
      // =================================================

      // =================================================*
// GET LATEST SAMPLE
// =================================================

const sample =
  student.faceSamples[
    student.faceSamples.length - 1
  ];

// =================================================*
// CLOUDINARY SAMPLE
// =================================================

if (sample.cloudinaryPublicId) {
  try {
    const signedUrl =
      getCloudinaryFaceUrl(
        sample.cloudinaryPublicId
      );

    console.log(
      "FACE IMAGE FROM CLOUDINARY:",
      schoolId,
      "ROLE:",
      role,
      "PUBLIC ID:",
      sample.cloudinaryPublicId
    );

    const cloudinaryResponse =
      await fetch(signedUrl);

    if (!cloudinaryResponse.ok) {
      console.error(
        "CLOUDINARY IMAGE FETCH FAILED:",
        cloudinaryResponse.status
      );

      return res.status(404).json({
        message:
          "Cloudinary face image could not be retrieved.",
      });
    }

    const imageBuffer =
      Buffer.from(
        await cloudinaryResponse.arrayBuffer()
      );

    res.set(
      "Cache-Control",
      "no-store"
    );

    res.type("image/jpeg");

    return res.send(imageBuffer);
  } catch (cloudinaryError) {
    console.error(
      "CLOUDINARY FACE IMAGE ERROR:",
      cloudinaryError
    );

    return res.status(500).json({
      message:
        "Unable to retrieve Cloudinary face image.",
    });
  }
}

// =================================================*
// LEGACY LOCAL FILE FALLBACK
// =================================================

const relativePath =
  sample.imagePath;

const absolutePath =
  path.resolve(
    __dirname,
    "..",
    relativePath
  );

const resolvedUploadDir =
  path.resolve(uploadDir) +
  path.sep;

if (
  !absolutePath.startsWith(
    resolvedUploadDir
  )
) {
  return res.status(400).json({
    message:
      "Invalid face sample path.",
  });
}

const fileExists =
  fs.existsSync(absolutePath);

console.log(
  "FACE IMAGE REQUEST:",
  schoolId,
  "ROLE:",
  role,
  "PATH:",
  absolutePath,
  "EXISTS:",
  fileExists
);

if (!fileExists) {
  return res.status(404).json({
    message:
      "Face image file is missing.",
  });
}

res.set(
  "Cache-Control",
  "no-store"
);

res.type("image/jpeg");

return res.sendFile(
  absolutePath
);

    } catch (error) {
      console.error(
        "GET FACE SAMPLE IMAGE:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to retrieve face image.",
      });
    }
  }
);

// =====================================================
// GET FACE SAMPLES FOR FACULTY SCHEDULE
// GET /api/face-enrollment/schedule/:scheduleId
//
// FACULTY ONLY
// =====================================================

router.get(
  "/schedule/:scheduleId",
  verifyToken,

  async (req, res) => {
    try {

      // =================================================
      // VERIFY FACULTY
      // =================================================

      if (req.user.role !== "faculty") {
        return res.status(403).json({
          message:
            "Faculty access required.",
        });
      }

      // =================================================
      // FIND SCHEDULE
      // =================================================

      const schedule =
        await Schedule.findById(
          req.params.scheduleId
        );

      if (!schedule) {
        return res.status(404).json({
          message:
            "Schedule not found.",
        });
      }

      // =================================================
      // VERIFY FACULTY OWNS SCHEDULE
      // =================================================

      if (
        schedule.faculty.toString() !==
        req.user.id
      ) {
        return res.status(403).json({
          message:
            "You are not assigned to this schedule.",
        });
      }

      // =================================================
      // DEBUG SCHEDULE
      // =================================================

      console.log(
        "\n=============================================="
      );

      console.log(
        "FACE SCHEDULE DEBUG"
      );

      console.log(
        "=============================================="
      );

      console.log(
        "Schedule ID:",
        schedule._id.toString()
      );

      console.log(
        "Faculty:",
        schedule.faculty
          ? schedule.faculty.toString()
          : "MISSING"
      );

      console.log(
        "Subject:",
        schedule.subject || "MISSING"
      );

      console.log(
        "Subject Code:",
        schedule.subjectCode || "MISSING"
      );

      console.log(
        "Grade:",
        schedule.gradeLevel || "MISSING"
      );

      console.log(
        "Section:",
        schedule.section || "MISSING"
      );

      console.log(
        "Academic Year:",
        schedule.academicYear
          ? schedule.academicYear.toString()
          : "MISSING"
      );

      console.log(
        "Semester:",
        schedule.semester
          ? schedule.semester.toString()
          : "MISSING"
      );

      console.log(
        "=============================================="
      );

      // =================================================
      // FIND MATCHING ENROLLMENTS
      // =================================================

      const enrollments =
        await Enrollment.find({
          gradeLevel:
            schedule.gradeLevel,

          section:
            schedule.section,

          status:
            "Enrolled",

          academicYear:
            schedule.academicYear,

          semester:
            schedule.semester,
        });

      console.log(
        "Matching enrollments:",
        enrollments.length
      );

      // =================================================
      // DEBUG ENROLLMENTS
      // =================================================

      if (enrollments.length === 0) {

        console.log(
          "NO MATCHING ENROLLMENTS FOUND."
        );

        console.log(
          "The schedule values do not match the enrolled students."
        );

      } else {

        enrollments.forEach(
          (enrollment, index) => {

            console.log(
              "\nEnrollment #" +
              (index + 1)
            );

            console.log(
              "  Student:",
              enrollment.student
                ? enrollment.student.toString()
                : "MISSING"
            );

            console.log(
              "  Grade:",
              enrollment.gradeLevel
            );

            console.log(
              "  Section:",
              enrollment.section
            );

            console.log(
              "  Status:",
              enrollment.status
            );

            console.log(
              "  Academic Year:",
              enrollment.academicYear
                ? enrollment.academicYear.toString()
                : "MISSING"
            );

            console.log(
              "  Semester:",
              enrollment.semester
                ? enrollment.semester.toString()
                : "MISSING"
            );
          }
        );
      }

      console.log(
        "\n=============================================="
      );

      // =================================================
      // POPULATE STUDENTS WITH FACE DATA
      // =================================================

      const populatedEnrollments =
        await Enrollment.find({
          gradeLevel:
            schedule.gradeLevel,

          section:
            schedule.section,

          status:
            "Enrolled",

          academicYear:
            schedule.academicYear,

          semester:
            schedule.semester,

        }).populate({
          path: "student",

          select:
            "+faceSamples firstName middleName lastName schoolId faceEnrollmentStatus",
        });

      // =================================================
      // DEBUG POPULATED STUDENTS
      // =================================================

      console.log(
        "Populated enrollments:",
        populatedEnrollments.length
      );

      populatedEnrollments.forEach(
        (enrollment, index) => {

          console.log(
            "\nPopulated Student #" +
            (index + 1)
          );

          console.log(
            "  Student exists:",
            !!enrollment.student
          );

          if (enrollment.student) {

            console.log(
              "  School ID:",
              enrollment.student.schoolId
            );

            console.log(
              "  Name:",
              enrollment.student.firstName,
              enrollment.student.middleName || "",
              enrollment.student.lastName
            );

            console.log(
              "  Face status:",
              enrollment.student.faceEnrollmentStatus
            );

            console.log(
              "  Face samples:",
              enrollment.student.faceSamples
                ? enrollment.student.faceSamples.length
                : 0
            );
          }
        }
      );

      // =================================================
      // BUILD STUDENTS
      // =================================================

      const students =
        populatedEnrollments
          .filter(
            enrollment =>
              enrollment.student &&
              enrollment.student.faceEnrollmentStatus ===
                "enrolled"
          )
          .map(
            enrollment => ({

              studentId:
                enrollment.student._id,

              schoolId:
                enrollment.student.schoolId,

              firstName:
                enrollment.student.firstName,

              middleName:
                enrollment.student.middleName,

              lastName:
                enrollment.student.lastName,

              faceEnrollmentStatus:
                enrollment.student.faceEnrollmentStatus,

              
samples: (
  enrollment.student.faceSamples || []
)
  .map((sample, index) => ({ sample, index }))
  .filter(({ sample }) => {
    // Cloudinary-backed samples use persistent storage.
    if (sample.cloudinaryPublicId) {
      return true;
    }

    // Legacy local samples are usable only if the
    // file still exists inside the face-samples folder.
    if (!sample.imagePath) {
      return false;
    }

    const absolutePath = path.resolve(
      __dirname,
      "..",
      sample.imagePath
    );

    const resolvedUploadDir =
      path.resolve(uploadDir) + path.sep;

    return (
      absolutePath.startsWith(resolvedUploadDir) &&
      fs.existsSync(absolutePath)
    );
  })
  .map(({ index }) => index),
            })
          );

      // =================================================
      // FINAL DEBUG
      // =================================================

      console.log(
        "\nStudents returned:",
        students.length
      );

      students.forEach(
        (student, index) => {

          console.log(
            "  Student #" +
            (index + 1) +
            ":",
            student.schoolId,
            "| Samples:",
            student.samples.length
          );
        }
      );

      console.log(
        "==============================================\n"
      );

      // =================================================
      // RESPONSE
      // =================================================

      return res.json({
        scheduleId:
          schedule._id,

        students,
      });

    } catch (error) {

      console.error(
        "GET SCHEDULE FACE STUDENTS:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to retrieve face students.",
      });
    }
  }
);

// =====================================================
// GET SPECIFIC FACE SAMPLE
//
// GET
// /api/face-enrollment/schedule/:scheduleId/student/:studentId/sample/:sampleIndex
//
// FACULTY ONLY
// =====================================================

router.get(
  "/schedule/:scheduleId/student/:studentId/sample/:sampleIndex",
  verifyToken,

  async (req, res) => {
    try {

      // =================================================
      // VERIFY FACULTY
      // =================================================

      if (req.user.role !== "faculty") {
        return res.status(403).json({
          message:
            "Faculty access required.",
        });
      }

      const {
        scheduleId,
        studentId,
        sampleIndex,
      } = req.params;

      // -------------------------------------------------
      // Validate sample index
      // -------------------------------------------------

      const index =
        Number(sampleIndex);

      if (
        Number.isNaN(index) ||
        index < 0
      ) {
        return res.status(400).json({
          message:
            "Invalid sample index.",
        });
      }

      // -------------------------------------------------
      // Find schedule
      // -------------------------------------------------

      const schedule =
        await Schedule.findById(
          scheduleId
        );

      if (!schedule) {
        return res.status(404).json({
          message:
            "Schedule not found.",
        });
      }

      // -------------------------------------------------
      // Verify faculty owns schedule
      // -------------------------------------------------

      if (
        schedule.faculty.toString() !==
        req.user.id
      ) {
        return res.status(403).json({
          message:
            "You are not assigned to this schedule.",
        });
      }

      // -------------------------------------------------
      // Find student enrollment
      // -------------------------------------------------

      const enrollment =
        await Enrollment.findOne({
          student: studentId,

          gradeLevel:
            schedule.gradeLevel,

          section:
            schedule.section,

          status:
            "Enrolled",

          academicYear:
            schedule.academicYear,

          semester:
            schedule.semester,
        });

      if (!enrollment) {
        return res.status(403).json({
          message:
            "Student is not enrolled in this schedule.",
        });
      }

      // -------------------------------------------------
      // Find student
      // -------------------------------------------------

      const student =
        await User.findById(studentId)
          .select("+faceSamples");

      if (!student) {
        return res.status(404).json({
          message:
            "Student not found.",
        });
      }

      if (
        student.faceEnrollmentStatus !==
        "enrolled"
      ) {
        return res.status(404).json({
          message:
            "Student has no enrolled face.",
        });
      }

      // -------------------------------------------------
      // Check sample
      // -------------------------------------------------

      if (
        !student.faceSamples ||
        !student.faceSamples[index]
      ) {
        return res.status(404).json({
          message:
            "Face sample not found.",
        });
      }

      const sample =
  student.faceSamples[index];

// =================================================*
// CLOUDINARY SAMPLE
// =================================================

if (sample.cloudinaryPublicId) {
  try {
    const signedUrl =
      getCloudinaryFaceUrl(
        sample.cloudinaryPublicId
      );

    console.log(
      "FACE SAMPLE FROM CLOUDINARY:",
      student.schoolId,
      "SAMPLE INDEX:",
      index,
      "PUBLIC ID:",
      sample.cloudinaryPublicId
    );

    const cloudinaryResponse =
      await fetch(signedUrl);

    if (!cloudinaryResponse.ok) {
      console.error(
        "CLOUDINARY SAMPLE FETCH FAILED:",
        cloudinaryResponse.status
      );

      return res.status(404).json({
        message:
          "Cloudinary face sample could not be retrieved.",
      });
    }

    const imageBuffer =
      Buffer.from(
        await cloudinaryResponse.arrayBuffer()
      );

    res.set(
      "Cache-Control",
      "no-store"
    );

    res.type("image/jpeg");

    return res.send(imageBuffer);
  } catch (cloudinaryError) {
    console.error(
      "CLOUDINARY SAMPLE ERROR:",
      cloudinaryError
    );

    return res.status(500).json({
      message:
        "Unable to retrieve Cloudinary face sample.",
    });
  }
}

// =================================================*
// LEGACY LOCAL FILE FALLBACK
// =================================================

const absolutePath =
  path.resolve(
    __dirname,
    "..",
    sample.imagePath
  );

const resolvedUploadDir =
  path.resolve(uploadDir) +
  path.sep;

if (
  !absolutePath.startsWith(
    resolvedUploadDir
  )
) {
  return res.status(400).json({
    message:
      "Invalid face sample path.",
  });
}

if (
  !fs.existsSync(
    absolutePath
  )
) {
  return res.status(404).json({
    message:
      "Face image file is missing.",
  });
}

res.set(
  "Cache-Control",
  "no-store"
);

res.type("image/jpeg");

return res.sendFile(
  absolutePath
);

    } catch (error) {

      console.error(
        "GET SPECIFIC FACE SAMPLE:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to retrieve face sample.",
      });
    }
  }
);

// =====================================================
// MULTER ERROR HANDLER
// =====================================================

router.use(
  (error, req, res, next) => {

    if (
      error instanceof multer.MulterError
    ) {

      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res.status(400).json({
          message:
            "Image must not exceed 5 MB.",
        });
      }

      return res.status(400).json({
        message:
          error.message,
      });
    }

    if (error) {
      return res.status(400).json({
        message:
          error.message ||
          "Upload error.",
      });
    }

    next();
  }
);

// =====================================================
// EXPORT
// =====================================================

module.exports = router;