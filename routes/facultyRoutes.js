const express = require("express");
const router = express.Router();

const Schedule = require("../models/Schedule");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");

const isObjectId = id =>
  /^[0-9a-fA-F]{24}$/.test(String(id || ""));

const getId = value =>
  value?._id || value || null;


/* ======================================================
   FACULTY DASHBOARD
====================================================== */

router.get("/dashboard/:facultyId", async (req, res) => {
  try {
    const { facultyId } = req.params;

    console.log("FACULTY DASHBOARD ID:", facultyId);

    const faculty = await User.findById(
      facultyId,
      "firstName middleName lastName schoolId department email role"
    ).lean();

    if (!faculty) {
      return res.status(404).json({
        message: "Faculty not found",
      });
    }

    /*
    ------------------------------------------------------
    GET FACULTY SCHEDULES

    Do NOT populate academicYear / semester here because
    some existing schedules may store them as strings.
    ------------------------------------------------------
    */

    const schedules = await Schedule.find({
      faculty: facultyId,
    })
      .populate("curriculumSubject")
      .populate(
        "faculty",
        "firstName middleName lastName"
      )
      .lean();

    console.log(
      "FACULTY SCHEDULES:",
      schedules.length
    );

    /*
    ------------------------------------------------------
    TODAY
    ------------------------------------------------------
    */

    const today = new Date().toLocaleDateString(
      "en-US",
      { weekday: "long" }
    );

    const todaySchedules = schedules.filter(s => {
      const days = String(s.days || "")
        .toLowerCase()
        .replace(/\s+/g, "");

      return days.includes(
        today.toLowerCase()
      );
    });

    /*
    ------------------------------------------------------
    STUDENT COUNT
    ------------------------------------------------------
    */

    const studentMap = new Map();

    for (const schedule of schedules) {

      const academicYear =
        getId(schedule.academicYear);

      const semester =
        getId(schedule.semester);

      const query = {
        gradeLevel: schedule.gradeLevel,
        section: schedule.section,
        status: "Enrolled",
      };

      /*
      Academic Year can be either:
      - ObjectId
      - "2026-2027"
      */

      if (academicYear) {
        query.academicYear = isObjectId(
          academicYear
        )
          ? academicYear
          : String(academicYear);
      }

      /*
      Semester can also be either an ObjectId
      or a string.
      */

      if (semester) {
        query.semester = isObjectId(semester)
          ? semester
          : String(semester);
      }

      console.log(
        "CHECKING CLASS:",
        schedule.subject,
        schedule.gradeLevel,
        schedule.section,
        "AY:",
        academicYear,
        "SEM:",
        semester
      );

      try {
        const enrollments =
          await Enrollment.find(query)
            .select("student")
            .lean();

        enrollments.forEach(e => {
          if (e.student) {
            studentMap.set(
              String(e.student),
              true
            );
          }
        });

      } catch (err) {
        console.error(
          "Enrollment lookup failed:",
          err.message
        );
      }
    }

    /*
    ------------------------------------------------------
    RESPONSE
    ------------------------------------------------------
    */

    res.json({
      faculty,

      stats: {
        totalSchedules:
          schedules.length,

        todayClasses:
          todaySchedules.length,

        studentCount:
          studentMap.size,

        announcementCount: 0,
      },

      todaySchedules,
    });

  } catch (err) {

    console.error(
      "❌ FACULTY DASHBOARD ERROR:",
      err
    );

    res.status(500).json({
      message: err.message,
    });
  }
});


/* ======================================================
   STUDENTS ASSIGNED TO FACULTY
====================================================== */

router.get("/students/:facultyId", async (req, res) => {
  try {
    const { facultyId } = req.params;

    console.log(
      "===================================="
    );

    console.log(
      "FACULTY STUDENTS REQUEST"
    );

    console.log(
      "Faculty ID:",
      facultyId
    );

    console.log(
      "===================================="
    );

    /*
    ------------------------------------------------------
    GET FACULTY SCHEDULES
    ------------------------------------------------------
    */

    const schedules = await Schedule.find({
      faculty: facultyId,
    })
      .populate("curriculumSubject")
      .lean();

    console.log(
      "Faculty schedules found:",
      schedules.length
    );

    if (!schedules.length) {
      return res.json([]);
    }

    /*
    ------------------------------------------------------
    STUDENT MAP
    ------------------------------------------------------
    */

    const studentMap = new Map();

    /*
    ------------------------------------------------------
    LOOP THROUGH FACULTY CLASSES
    ------------------------------------------------------
    */

    for (const schedule of schedules) {

      const academicYear =
        getId(schedule.academicYear);

      const semester =
        getId(schedule.semester);

      const query = {
        gradeLevel:
          schedule.gradeLevel,

        section:
          schedule.section,

        status:
          "Enrolled",
      };

      if (academicYear) {
        query.academicYear =
          isObjectId(academicYear)
            ? academicYear
            : String(academicYear);
      }

      if (semester) {
        query.semester =
          isObjectId(semester)
            ? semester
            : String(semester);
      }

      console.log(
        "------------------------------------"
      );

      console.log(
        "Subject:",
        schedule.subject
      );

      console.log(
        "Grade:",
        schedule.gradeLevel
      );

      console.log(
        "Section:",
        schedule.section
      );

      console.log(
        "Academic Year:",
        academicYear
      );

      console.log(
        "Semester:",
        semester
      );

      /*
      ----------------------------------------------------
      FIND ENROLLED STUDENTS
      ----------------------------------------------------
      */

      let enrollments = [];

      try {

        enrollments =
          await Enrollment.find(query)
            .populate(
              "student",
              "firstName middleName lastName schoolId email gradeLevel section"
            )
            .lean();

      } catch (err) {

        console.error(
          "Enrollment lookup error:",
          err.message
        );

        continue;
      }

      console.log(
        "Matching enrollments:",
        enrollments.length
      );

      /* ================= ANNOUNCEMENTS ================= */

let announcementCount = 0;

try {
  announcementCount =
    await Announcement.countDocuments({
      audience: {
        $in: ["all", "faculty"]
      }
    });
} catch (err) {
  console.log(
    "Announcement count skipped:",
    err.message
  );
}

      /*
      ----------------------------------------------------
      ADD STUDENTS
      ----------------------------------------------------
      */

      for (const enrollment of enrollments) {

        if (!enrollment.student)
          continue;

        const student =
          enrollment.student;

        const studentId =
          String(student._id);

        /*
        First time seeing student
        */

        if (!studentMap.has(studentId)) {

          studentMap.set(
            studentId,
            {
              _id: student._id,

              firstName:
                student.firstName,

              middleName:
                student.middleName,

              lastName:
                student.lastName,

              schoolId:
                student.schoolId,

              email:
                student.email,

              gradeLevel:
                enrollment.gradeLevel,

              section:
                enrollment.section,

              subjects: [
                {
                  subject:
                    schedule.subject,

                  subjectCode:
                    schedule.subjectCode,

                  scheduleId:
                    schedule._id,
                },
              ],
            }
          );

        } else {

          /*
          Student already exists because they
          belong to another class taught by
          the same faculty.
          */

          const existing =
            studentMap.get(studentId);

          const exists =
            existing.subjects.some(
              s =>
                String(s.scheduleId) ===
                String(schedule._id)
            );

          if (!exists) {

            existing.subjects.push({
              subject:
                schedule.subject,

              subjectCode:
                schedule.subjectCode,

              scheduleId:
                schedule._id,
            });

          }
        }
      }
    }

    /*
    ------------------------------------------------------
    RESPONSE
    ------------------------------------------------------
    */

    const students =
      Array.from(
        studentMap.values()
      );

    console.log(
      "TOTAL STUDENTS RETURNED:",
      students.length
    );

    console.log(
      "===================================="
    );

    res.json(students);

  } catch (err) {

    console.error(
      "❌ FACULTY STUDENTS ERROR:",
      err
    );

    res.status(500).json({
      message: err.message,
    });
  }
});


module.exports = router;