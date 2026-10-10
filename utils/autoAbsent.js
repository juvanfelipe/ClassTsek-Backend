
const Attendance = require("../models/Attendance");
const Schedule = require("../models/Schedule");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const Notification = require("../models/Notification");

const TIME_ZONE = "Asia/Manila";
const GRACE_MINUTES = 10;

function getLocalDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    month: "numeric",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getLocalParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );
}

function parseTime(value) {
  if (!value) return null;

  const match = String(value).trim().match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i
  );

  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3]?.toUpperCase();

  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;

  if (hour > 23 || minute > 59) return null;

  return hour * 60 + minute;
}

function scheduleRunsToday(days, weekday) {
  if (!days) return false;

  const value = String(days).toLowerCase().trim();
  const names = {
    monday: ["monday", "mon"],
    tuesday: ["tuesday", "tue", "tues"],
    wednesday: ["wednesday", "wed"],
    thursday: ["thursday", "thu", "thur", "thurs"],
    friday: ["friday", "fri"],
    saturday: ["saturday", "sat"],
    sunday: ["sunday", "sun"],
  };

  const alternatives = names[weekday] || [];
  const tokens = value.split(/[,;/|]+|\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  // Supports full day names and common comma/slash-separated abbreviations.
  if (tokens.some((token) => alternatives.includes(token))) return true;

  // Also supports values such as "Monday Wednesday Friday".
  return alternatives.some((name) =>
    new RegExp(`(^|[^a-z])${name}([^a-z]|$)`, "i").test(value)
  );
}

async function finalizeSchedule(schedule, date, nowMinutes, weekday, io) {
  if (!scheduleRunsToday(schedule.days, weekday)) return;

  const endMinutes = parseTime(schedule.endTime);
  if (endMinutes === null) {
    console.warn(
      `[AUTO-ABSENT] Invalid end time for schedule ${schedule._id}:`,
      schedule.endTime
    );
    return;
  }

  // Do not create absences until end time + 10-minute grace period.
  if (nowMinutes < endMinutes + GRACE_MINUTES) return;

  const enrollments = await Enrollment.find({
    academicYear: schedule.academicYear,
    semester: schedule.semester,
    gradeLevel: schedule.gradeLevel,
    section: schedule.section,
    status: "Enrolled",
  }).select("student");

  if (!enrollments.length) return;

  const studentIds = [
    ...new Set(enrollments.map((item) => String(item.student))),
  ];

  // Find records already created for this class and local date.
  const existing = await Attendance.find({
    scheduleId: schedule._id,
    date,
    studentId: { $in: studentIds },
  }).select("studentId");

  const alreadyRecorded = new Set(
    existing.map((record) => String(record.studentId))
  );

  const missingIds = studentIds.filter(
    (studentId) => !alreadyRecorded.has(studentId)
  );

  if (!missingIds.length) return;

  const absences = await Attendance.insertMany(
    missingIds.map((studentId) => ({
      studentId,
      scheduleId: schedule._id,
      status: "Absent",
      excuseType: "",
      timeIn: "",
      timeOut: "",
      date,
    })),
    { ordered: false }
  );

  // Notify linked parents/guardians using the existing notification model.
  const students = await User.find({
    _id: { $in: absences.map((record) => record.studentId) },
  }).select("_id firstName lastName");

  for (const student of students) {
    const parents = await User.find({
      role: { $in: ["parent", "guardian"] },
      children: student._id,
    }).select("_id");

    if (!parents.length) continue;

    const fullName = [student.firstName, student.lastName]
      .filter(Boolean)
      .join(" ");

    const notifications = await Notification.insertMany(
      parents.map((parent) => ({
        recipientId: parent._id,
        senderId: schedule.faculty,
        type: "Attendance",
        title: "Absence Alert",
        message: `${fullName || "A student"} was marked Absent for class today.`,
        priority: "Urgent",
        relatedAttendanceId: absences.find(
          (record) => String(record.studentId) === String(student._id)
        )?._id,
        relatedStudentId: student._id,
      }))
    );

    if (io) {
      for (const notification of notifications) {
        io.to(`user_${notification.recipientId}`).emit(
          "newNotification",
          notification
        );
      }
    }
  }

  console.log(
    `[AUTO-ABSENT] Schedule ${schedule._id}: created ${absences.length} absence record(s) for ${date}.`
  );
}

async function processAutoAbsences(io) {
  const parts = getLocalParts();
  const date = getLocalDate();
  const nowMinutes = Number(parts.hour) * 60 + Number(parts.minute);

  const schedules = await Schedule.find({}).select(
    "_id faculty days endTime academicYear semester gradeLevel section"
  );

  for (const schedule of schedules) {
    try {
      await finalizeSchedule(
        schedule,
        date,
        nowMinutes,
        parts.weekday.toLowerCase(),
        io
      );
    } catch (error) {
      console.error(
        `[AUTO-ABSENT] Failed for schedule ${schedule._id}:`,
        error.message
      );
    }
  }
}

function startAutoAbsentScheduler(getIO) {
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;

    try {
      await processAutoAbsences(getIO?.());
    } catch (error) {
      console.error("[AUTO-ABSENT] Scheduler error:", error.message);
    } finally {
      running = false;
    }
  };

  // Run on startup, then check every minute.
  run();
  return setInterval(run, 60 * 1000);
}

module.exports = { startAutoAbsentScheduler, processAutoAbsences };
