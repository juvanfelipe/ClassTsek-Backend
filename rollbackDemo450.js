/**
 * Roll back only the records created by seedDemo450.js.
 * Run from server folder: node rollbackDemo450.js
 * Requires the exact manifest created by the seeder and a typed confirmation.
 */
'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mongoose = require('mongoose');
const { v2: cloudinary } = require('cloudinary');
const User = require('./models/User');
const Enrollment = require('./models/Enrollment');
const Schedule = require('./models/Schedule');
const CurriculumSubject = require('./models/CurriculumSubject');
const Curriculum = require('./models/Curriculum');
const LearningArea = require('./models/LearningArea');
const Attendance = require('./models/Attendance');

const TAG = 'demo-450';
const MANIFEST_PATH = path.join(__dirname, 'demo-450-seed-manifest.json');

function ask(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}
async function mapLimit(items, limit, worker) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  }));
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing from server/.env.');
  if (!fs.existsSync(MANIFEST_PATH)) throw new Error(`Seed manifest not found: ${MANIFEST_PATH}`);
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  if (manifest.source !== TAG) throw new Error('Manifest source tag did not match demo-450. Refusing rollback.');
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary credentials are missing from .env.');
  }
  cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });

  const taggedDemoUsers = await User.find({ isDemo: true, demoSource: TAG, schoolId: /^DEMO26-/ }).select('_id').lean();
  const userIds = [...new Set([...(manifest.userIds || []).map(String), ...taggedDemoUsers.map(u => String(u._id))])];
  const attendanceCount = userIds.length
    ? await Attendance.countDocuments({ studentId: { $in: userIds } })
    : 0;
  console.log(JSON.stringify({
    mode: 'ROLLBACK PREVIEW',
    source: manifest.source,
    users: userIds.length,
    enrollments: (manifest.enrollmentIds || []).length,
    schedules: (manifest.scheduleIds || []).length,
    curriculumSubjects: (manifest.curriculumSubjectIds || []).length,
    curricula: (manifest.curriculumIds || []).length,
    learningAreas: (manifest.learningAreaIds || []).length,
    cloudinaryImages: (manifest.cloudinaryPublicIds || []).length,
    attendanceRecordsForDemoStudents: attendanceCount,
  }, null, 2));

  if (attendanceCount > 0) {
    throw new Error(`Found ${attendanceCount} attendance records for demo students. Rollback stopped to preserve attendance history. Remove/reconcile those records deliberately before retrying.`);
  }

  const confirmation = await ask('\nType ROLLBACK DEMO450 to permanently remove only the demo-seeded records and Cloudinary images: ');
  if (confirmation !== 'ROLLBACK DEMO450') {
    console.log('Confirmation did not match. No records were deleted.');
    return;
  }

  // Delete dependent records first, and constrain every deletion to manifest IDs.
  const enrollmentResult = await Enrollment.deleteMany({
    $or: [
      { _id: { $in: manifest.enrollmentIds || [] } },
      { student: { $in: userIds } },
    ],
  });
  const scheduleResult = await Schedule.deleteMany({ _id: { $in: manifest.scheduleIds || [] } });
  const subjectResult = await CurriculumSubject.deleteMany({ _id: { $in: manifest.curriculumSubjectIds || [] } });
  const curriculumResult = await Curriculum.deleteMany({ _id: { $in: manifest.curriculumIds || [] }, name: /^DEMO450 / });
  const learningAreaResult = await LearningArea.deleteMany({ _id: { $in: manifest.learningAreaIds || [] }, name: /^DEMO450 - / });
  const userResult = await User.deleteMany({ _id: { $in: userIds }, isDemo: true, demoSource: TAG });

  let cloudinaryDeleted = 0;
  const cloudinaryErrors = [];
  await mapLimit(manifest.cloudinaryPublicIds || [], 4, async publicId => {
    try {
      const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image', type: 'authenticated', invalidate: true });
      if (result && (result.result === 'ok' || result.result === 'not found')) cloudinaryDeleted++;
      else cloudinaryErrors.push({ publicId, result: result && result.result });
    } catch (error) {
      cloudinaryErrors.push({ publicId, error: error.message });
    }
  });

  const archivePath = `${MANIFEST_PATH}.rolledback-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  if (cloudinaryErrors.length === 0) fs.renameSync(MANIFEST_PATH, archivePath);
  console.log(JSON.stringify({
    rollbackCompleted: cloudinaryErrors.length === 0,
    deleted: {
      enrollments: enrollmentResult.deletedCount,
      schedules: scheduleResult.deletedCount,
      curriculumSubjects: subjectResult.deletedCount,
      curricula: curriculumResult.deletedCount,
      learningAreas: learningAreaResult.deletedCount,
      demoUsers: userResult.deletedCount,
      cloudinaryImages: cloudinaryDeleted,
    },
    cloudinaryErrors,
    manifestArchive: cloudinaryErrors.length === 0 ? archivePath : MANIFEST_PATH,
  }, null, 2));
  if (cloudinaryErrors.length) throw new Error('Some Cloudinary images could not be deleted. The manifest was kept so cleanup can be retried.');
}

main()
  .catch(err => { console.error('\nROLLBACK ERROR:', err.message); process.exitCode = 1; })
  .finally(async () => { if (mongoose.connection.readyState !== 0) await mongoose.disconnect(); });
