const express = require("express");

const router = express.Router();

const Attendance = require("../models/Attendance");
const Schedule = require("../models/Schedule");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const Notification = require("../models/Notification");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

// ================= GET ALL =================
// Admin only

router.get("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Administrator access required.",
      });
    }

    const attendance = await Attendance.find()
      .populate(
        "studentId",
        "firstName middleName lastName schoolId"
      )
      .populate("scheduleId");

    res.json(attendance);
  } catch (error) {
    console.error("GET ATTENDANCE:", error);

    res.status(500).json({
      message: error.message,
    });
  }
});

// ================= PARENT ATTENDANCE =================
// Parent can only view attendance of their linked children.

router.get(
  "/parent/:parentId",
  verifyToken,
  async (req, res) => {
    try {
      const { parentId } = req.params;

      // Only parents/guardians can use this route.
      if (
        req.user.role !== "parent" &&
        req.user.role !== "guardian"
      ) {
        return res.status(403).json({
          message:
            "Parent or guardian access required.",
        });
      }

      // Parent can only access their own account.
      if (req.user.id !== parentId) {
        return res.status(403).json({
          message:
            "You are not authorized to view this parent's attendance.",
        });
      }

      // Get the logged-in parent.
      const parent = await User.findById(
        parentId
      ).select("children role status");

      if (!parent) {
        return res.status(404).json({
          message: "Parent account not found.",
        });
      }

      if (parent.status !== "active") {
        return res.status(403).json({
          message: "Parent account is inactive.",
        });
      }

      // Get linked children.
      const children = Array.isArray(
        parent.children
      )
        ? parent.children
        : [];

      const childIds = children
        .map((child) => {
          if (
            typeof child === "object" &&
            child !== null
          ) {
            return child._id || child.id;
          }

          return child;
        })
        .filter(Boolean);

      // No children linked to this parent.
      if (childIds.length === 0) {
        return res.json([]);
      }

      // Get attendance only for the parent's children.
      const attendance =
        await Attendance.find({
          studentId: {
            $in: childIds,
          },
        })
          .populate(
            "studentId",
            "firstName middleName lastName fullName schoolId gradeLevel section"
          )
          .populate(
            "scheduleId",
            "subject subjectName subjectCode gradeLevel section room startTime endTime days academicYear semester"
          )
          .sort({
            date: -1,
            createdAt: -1,
          });

      return res.json(attendance);
    } catch (error) {
      console.error(
        "GET PARENT ATTENDANCE:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to load parent attendance.",
      });
    }
  }
);

// ================= STUDENT ATTENDANCE =================
// Get attendance records for one student.

router.get(
  "/student/:studentId",
  verifyToken,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      // Only allow the logged-in student
      // to view their own attendance.
      if (
        req.user.role !== "student" ||
        req.user.id !== studentId
      ) {
        return res.status(403).json({
          message:
            "Student access denied.",
        });
      }

      const records =
        await Attendance.find({
          studentId,
        })
          .populate(
            "scheduleId",
            "subject subjectName subjectCode gradeLevel section room startTime endTime days"
          )
          .sort({
            date: -1,
            createdAt: -1,
          });

      return res.json(records);
    } catch (error) {
      console.error(
        "GET STUDENT ATTENDANCE:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to load student attendance.",
      });
    }
  }
);

// ================= FACULTY ATTENDANCE =================

router.get(
  "/faculty/:facultyId",
  verifyToken,
  async (req, res) => {
    try {
      // Faculty can only access their own attendance.
      if (
        req.user.role !== "faculty" ||
        req.user.id !== req.params.facultyId
      ) {
        return res.status(403).json({
          message:
            "Faculty access denied.",
        });
      }

      const schedules =
        await Schedule.find({
          faculty: req.user.id,
        }).select("_id");

      const scheduleIds =
        schedules.map(
          (schedule) =>
            schedule._id
        );

      const attendance =
        await Attendance.find({
          scheduleId: {
            $in: scheduleIds,
          },
        })
          .populate(
            "studentId",
            "firstName middleName lastName schoolId email gradeLevel section"
          )
          .populate(
            "scheduleId",
            "subject subjectCode section gradeLevel academicYear semester"
          )
          .sort({
            date: -1,
            createdAt: -1,
          });

      res.json(attendance);
    } catch (error) {
      console.error(
        "FACULTY ATTENDANCE:",
        error
      );

      res.status(500).json({
        message: error.message,
      });
    }
  }
);

// ================= CREATE =================

router.post(
  "/",
  verifyToken,
  async (req, res) => {
    try {
      const {
        studentId,
        scheduleId,
        status,
        excuseType,
        timeIn,
        timeOut,
        date,
      } = req.body;

      if (
        !studentId ||
        !scheduleId
      ) {
        return res.status(400).json({
          message:
            "Student and schedule are required.",
        });
      }

      // Only faculty or admin can create attendance.
      if (
        req.user.role !== "faculty" &&
        req.user.role !== "admin"
      ) {
        return res.status(403).json({
          message:
            "You are not allowed to record attendance.",
        });
      }

      // Make sure schedule exists.
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

      // Faculty can only record attendance
      // for their own schedule.
      if (
        req.user.role === "faculty" &&
        schedule.faculty.toString() !==
          req.user.id
      ) {
        return res.status(403).json({
          message:
            "You are not authorized to record attendance for this class.",
        });
      }

      // Make sure student is enrolled in this class.
      const enrollment =
        await Enrollment.findOne({
          student: studentId,
          academicYear:
            schedule.academicYear,
          semester:
            schedule.semester,
          gradeLevel:
            schedule.gradeLevel,
          section:
            schedule.section,
          status: "Enrolled",
        });

      if (!enrollment) {
        return res.status(400).json({
          message:
            "This student is not enrolled in the selected class.",
        });
      }

      // Prevent duplicate attendance.
      const attendanceDate =
        date ||
        new Date().toLocaleDateString();

      const existing =
        await Attendance.findOne({
          studentId,
          scheduleId,
          date: attendanceDate,
        });

      if (existing) {
        return res.status(409).json({
          message:
            "Attendance for this student and class has already been recorded today.",
        });
      }

      // Create attendance.
      const attendance =
        await Attendance.create({
          studentId,
          scheduleId,
          status:
            status || "Present",
          excuseType:
            excuseType || "",
          timeIn:
            timeIn || "",
          timeOut:
            timeOut || "",
          date: attendanceDate,
        });

      // ================= CREATE NOTIFICATION =================

      const student =
        await User.findById(studentId).select(
          "firstName middleName lastName schoolId"
        );

      if (student) {
        const parents =
          await User.find({
            role: {
              $in: [
                "parent",
                "guardian",
              ],
            },
            children: studentId,
          }).select("_id");

        if (parents.length > 0) {
          let title =
            "Attendance Recorded";

          let message =
            `${student.firstName} ${student.lastName} was marked ${attendance.status} today.`;

          let priority = "Normal";

          if (
            attendance.status === "Late"
          ) {
            title = "Late Attendance";

            message =
              `${student.firstName} ${student.lastName} was marked Late today.`;

            priority = "Important";
          }

          if (
            attendance.status === "Absent"
          ) {
            title = "Absence Alert";

            message =
              `${student.firstName} ${student.lastName} was marked Absent today.`;

            priority = "Urgent";
          }

          if (
            attendance.status === "Excused"
          ) {
            title =
              "Excused Attendance";

            message =
              `${student.firstName} ${student.lastName} was marked Excused today.`;
          }

          const createdNotifications =
            await Notification.insertMany(
              parents.map((parent) => ({
                recipientId:
                  parent._id,
                senderId:
                  req.user.id,
                type:
                  "Attendance",
                title,
                message,
                priority,
                relatedAttendanceId:
                  attendance._id,
                relatedStudentId:
                  studentId,
              }))
            );

          const io =
            req.app.get("io");

          if (io) {
            createdNotifications.forEach(
              (notification) => {
                io.to(
                  `user_${notification.recipientId}`
                ).emit(
                  "newNotification",
                  notification
                );
              }
            );
          }
        }
      }

      // Return populated attendance.
      const result =
        await Attendance.findById(
          attendance._id
        )
          .populate(
            "studentId",
            "firstName middleName lastName schoolId email gradeLevel section"
          )
          .populate(
            "scheduleId",
            "subject subjectCode section gradeLevel academicYear semester"
          );

      res.status(201).json(result);
    } catch (error) {
      console.error(
        "CREATE ATTENDANCE:",
        error
      );

      res.status(500).json({
        message: error.message,
      });
    }
  }
);

// ================= END CLASS =================
// Faculty may officially end the class from
// scheduled end time until 10 minutes after.
//
// IMPORTANT:
// - This does NOT create Time Out.
// - This does NOT modify attendance records.
// - This does NOT create Time Out notifications.
// - Face scanning is controlled separately by the Android app.
// - Server time is used to enforce the 10-minute limit.

router.post(
  "/end-class",
  verifyToken,
  async (req, res) => {
    try {
      // Only faculty can end a class.
      if (req.user.role !== "faculty") {
        return res.status(403).json({
          message:
            "Faculty access required.",
        });
      }

      const {
        scheduleId,
      } = req.body;

      if (!scheduleId) {
        return res.status(400).json({
          message:
            "Schedule ID is required.",
        });
      }

      // Make sure this schedule belongs
      // to the logged-in faculty.
      const schedule =
        await Schedule.findOne({
          _id: scheduleId,
          faculty: req.user.id,
        });

      if (!schedule) {
        return res.status(404).json({
          message:
            "Schedule not found or access denied.",
        });
      }

      // =================================================
      // SERVER-SIDE END CLASS TIME CHECK
      // =================================================

      const now = new Date();

      const parseTime = (timeString) => {
        if (!timeString) {
          return null;
        }

        const match =
          timeString
            .trim()
            .match(
              /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i
            );

        if (!match) {
          return null;
        }

        let hour =
          parseInt(match[1], 10);

        const minute =
          parseInt(match[2], 10);

        const period =
          match[3]
            ? match[3].toUpperCase()
            : null;

        if (
          period === "PM" &&
          hour !== 12
        ) {
          hour += 12;
        }

        if (
          period === "AM" &&
          hour === 12
        ) {
          hour = 0;
        }

        if (
          hour < 0 ||
          hour > 23 ||
          minute < 0 ||
          minute > 59
        ) {
          return null;
        }

        return {
          hour,
          minute,
        };
      };

      const endTime =
        parseTime(schedule.endTime);

      if (!endTime) {
        return res.status(400).json({
          message:
            "Invalid schedule end time.",
        });
      }

      // Build today's scheduled end time
      // using SERVER time/date.
      const scheduledEnd =
        new Date(now);

      scheduledEnd.setHours(
        endTime.hour,
        endTime.minute,
        0,
        0
      );

      // Teacher can press End Class
      // only from scheduled end time
      // until 10 minutes afterward.
      const graceEnd =
        new Date(
          scheduledEnd.getTime() +
            10 * 60 * 1000
        );

      // Before scheduled end.
      if (
        now.getTime() <
        scheduledEnd.getTime()
      ) {
        return res.status(403).json({
          message:
            "The class has not reached its scheduled end time yet.",
          scheduledEnd:
            scheduledEnd.toISOString(),
          graceEnd:
            graceEnd.toISOString(),
        });
      }

      // Ten-minute End Class grace period expired.
      if (
        now.getTime() >=
        graceEnd.getTime()
      ) {
        return res.status(403).json({
          message:
            "The End Class period has expired. You can no longer end this class.",
          scheduledEnd:
            scheduledEnd.toISOString(),
          graceEnd:
            graceEnd.toISOString(),
        });
      }

      // =================================================
      // CLASS CAN NOW BE OFFICIALLY ENDED
      // =================================================

      return res.json({
        message:
          "Class ended successfully.",
        scheduleId:
          scheduleId,
        scheduledEnd:
          scheduledEnd.toISOString(),
        endedAt:
          now.toISOString(),
        graceEnd:
          graceEnd.toISOString(),
      });
    } catch (error) {
      console.error(
        "END CLASS ERROR:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to end class.",
      });
    }
  }
);

// ================= DELETE =================

router.delete(
  "/:id",
  verifyToken,
  async (req, res) => {
    try {
      if (
        req.user.role !== "admin" &&
        req.user.role !== "faculty"
      ) {
        return res.status(403).json({
          message:
            "You are not allowed to delete attendance.",
        });
      }

      const attendance =
        await Attendance.findById(
          req.params.id
        );

      if (!attendance) {
        return res.status(404).json({
          message:
            "Attendance not found.",
        });
      }

      // Faculty can only delete attendance
      // belonging to their own schedule.
      if (
        req.user.role === "faculty"
      ) {
        const schedule =
          await Schedule.findById(
            attendance.scheduleId
          );

        if (
          !schedule ||
          schedule.faculty.toString() !==
            req.user.id
        ) {
          return res.status(403).json({
            message:
              "You are not authorized to delete this attendance.",
          });
        }
      }

      await Attendance.findByIdAndDelete(
        req.params.id
      );

      res.json({
        message:
          "Attendance deleted successfully.",
      });
    } catch (error) {
      console.error(
        "DELETE ATTENDANCE:",
        error
      );

      res.status(500).json({
        message: error.message,
      });
    }
  }
);

module.exports = router;