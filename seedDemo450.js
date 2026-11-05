/**
 * ClassTsek Demo Seed - 450 synthetic students + face-loading fixtures.
 *
 * SAFETY:
 * - Dry-run by default. Live writes require --apply AND typing the exact phrase.
 * - Creates only records tagged isDemo=true / demoSource='demo-450'.
 * - Never edits or deletes existing users, curricula, enrollments, or schedules.
 * - Face fixtures are synthetic performance-test images, not biometric identities.
 * - The Android patch downloads/processes demo images but excludes them from matching.
 *
 * Run from server folder:
 *   node seedDemo450.js                 (read-only plan)
 *   node seedDemo450.js --apply         (asks for confirmation before writes)
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v2: cloudinary } = require('cloudinary');

const User = require('./models/User');
const AcademicYear = require('./models/AcademicYear');
const Semester = require('./models/Semester');
const Curriculum = require('./models/Curriculum');
const LearningArea = require('./models/LearningArea');
const CurriculumSubject = require('./models/CurriculumSubject');
const Schedule = require('./models/Schedule');
const Enrollment = require('./models/Enrollment');

const TAG = 'demo-450';
const SCHOOL_ID_PREFIX = 'DEMO26-';
const TARGET_COUNT = 450;
const CAPACITY = 40;
const ROOT = __dirname;
const ASSET_DIR = path.join(ROOT, 'demo-face-assets');
const MANIFEST_PATH = path.join(ROOT, 'demo-450-seed-manifest.json');
const IS_APPLY = process.argv.includes('--apply');

const GRADES = [
  { grade: 'Grade 7', number: 7, department: 'Junior High School' },
  { grade: 'Grade 8', number: 8, department: 'Junior High School' },
  { grade: 'Grade 9', number: 9, department: 'Junior High School' },
  { grade: 'Grade 10', number: 10, department: 'Junior High School' },
  { grade: 'Grade 11', number: 11, department: 'Senior High School' },
  { grade: 'Grade 12', number: 12, department: 'Senior High School' },
];
const SECTIONS = ['A', 'B'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = [
  ['07:00', '07:45'], ['07:50', '08:35'], ['08:40', '09:25'],
  ['09:30', '10:15'], ['10:20', '11:05'], ['11:10', '11:55'],
  ['13:00', '13:45'], ['13:50', '14:35'], ['14:40', '15:25'],
  ['15:30', '16:15'], ['16:20', '17:05'], ['17:10', '17:55'],
];

const JHS_SUBJECTS = [
  { area: 'English', name: 'English Language Arts', code: 'ENG', units: 1 },
  { area: 'Filipino', name: 'Filipino', code: 'FIL', units: 1 },
  { area: 'Mathematics', name: 'Mathematics', code: 'MATH', units: 1 },
  { area: 'Science', name: 'Integrated Science', code: 'SCI', units: 1 },
  { area: 'Araling Panlipunan', name: 'Araling Panlipunan', code: 'AP', units: 1 },
  { area: 'MAPEH', name: 'Music, Arts, Physical Education and Health', code: 'MAPEH', units: 1 },
];
const SHS_SUBJECTS = [
  { area: 'Oral Communication', name: 'Oral Communication', code: 'OC', units: 1 },
  { area: 'Komunikasyon', name: 'Komunikasyon at Pananaliksik', code: 'KPW', units: 1 },
  { area: 'General Mathematics', name: 'General Mathematics', code: 'GENMATH', units: 1 },
  { area: 'Earth and Life Science', name: 'Earth and Life Science', code: 'ELS', units: 1 },
  { area: 'Personal Development', name: 'Personal Development', code: 'PERDEV', units: 1 },
  { area: 'Physical Education and Health', name: 'Physical Education and Health', code: 'PEH', units: 1 },
];

const FIRST_NAMES = [
  'Adrian','Aira','Alyssa','Andrea','Angelo','Angela','Anthony','Bea','Bryan','Camille',
  'Carlo','Cassandra','Christian','Christine','Daniel','Danica','Daphne','Daryl','Diana','Earl',
  'Elaine','Elijah','Ella','Emmanuel','Erika','Faith','Gabriel','Gian','Hannah','Harold',
  'Ian','Isabel','Jaira','Janelle','Jasmine','Jayson','Jericho','John','Joshua','Joy',
  'Karl','Kathleen','Kim','Kyle','Lance','Leah','Liam','Loren','Louise','Mae',
  'Mark','Mary','Matthew','Mia','Miguel','Nathan','Nicole','Paolo','Patricia','Rafael',
  'Rhea','Rianne','Rico',' Samantha','Sean','Sofia','Trisha','Vincent','Zachary','Zia'
].map(x => x.trim());
const MIDDLE_NAMES = [
  'Abad','Aguilar','Alonzo','Andrada','Aquino','Bautista','Castillo','Cruz','Dela Cruz','De Leon',
  'Domingo','Espiritu','Fernandez','Garcia','Gonzales','Hernandez','Lim','Lopez','Manalo','Mendoza',
  'Navarro','Pascual','Reyes','Rivera','Rodriguez','Santos','Soriano','Tan','Torres','Villanueva'
];
const LAST_NAMES = [
  'Abad','Aguilar','Alcantara','Alvarez','Andrada','Aquino','Bautista','Bernardo','Castillo','Cruz',
  'Dela Cruz','De Leon','Delos Reyes','Domingo','Evangelista','Fernandez','Garcia','Gonzales','Gutierrez','Hernandez',
  'Labrador','Lim','Lopez','Manalo','Mendoza','Navarro','Ocampo','Pascual','Reyes','Rivera',
  'Rodriguez','Santiago','Santos','Soriano','Tan','Torres','Valdez','Villanueva','Yap','Zamora'
];

function idOf(v) { return String(v && v._id ? v._id : (v || '')); }
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function saveManifest(m) {
  const tmp = `${MANIFEST_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(m, null, 2));
  fs.renameSync(tmp, MANIFEST_PATH);
}
function ask(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}
function parseTime(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}
function parseDays(value) {
  const raw = String(value || '').toLowerCase().replace(/\s+/g, '');
  const dayIndex = name => DAYS.findIndex(d => d.toLowerCase() === name);
  const range = raw.match(/(monday|tuesday|wednesday|thursday|friday|saturday)\s*-\s*(monday|tuesday|wednesday|thursday|friday|saturday)/);
  if (range) {
    const start = dayIndex(range[1]);
    const end = dayIndex(range[2]);
    if (start >= 0 && end >= start) return DAYS.slice(start, end + 1);
  }
  const found = DAYS.filter(d => raw.includes(d.toLowerCase()));
  return found.length ? found : DAYS;
}
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}
function randomItem(list, n) { return list[n % list.length]; }
function makeBirthDate(gradeNumber, index) {
  const age = gradeNumber + 5; // Grade 7 => 12; Grade 12 => 17.
  const year = 2026 - age;
  const month = ((index * 7) % 12) + 1;
  const day = ((index * 11) % 27) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function createStudentIdentity(i, placement) {
  const first = randomItem(FIRST_NAMES, i * 13 + 3);
  const middle = randomItem(MIDDLE_NAMES, i * 7 + 5);
  const last = randomItem(LAST_NAMES, i * 17 + 9);
  const schoolId = `${SCHOOL_ID_PREFIX}${String(i + 1).padStart(4, '0')}`;
  const grade = GRADES.find(g => g.grade === placement.gradeLevel);
  const gender = (i % 2 === 0) ? 'Female' : 'Male';
  const fullName = `${first} ${middle} ${last}`;
  return {
    firstName: first,
    middleName: middle,
    lastName: last,
    fullName,
    schoolId,
    email: `demo26-${String(i + 1).padStart(4, '0')}@demo.classtsek.invalid`,
    phoneNumber: '',
    address: 'SYNTHETIC DEMO RECORD - NOT A REAL PERSON',
    gender,
    birthDate: makeBirthDate(grade.number, i),
    gradeLevel: placement.gradeLevel,
    section: placement.section,
    department: grade.department,
    curriculum: null,
    subject: '',
    profileImage: '',
    faceEnrollmentStatus: 'enrolled',
    faceSamples: [],
    role: 'student',
    status: 'active',
    isDemo: true,
    demoSource: TAG,
  };
}

async function mapLimit(items, limit, worker) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

function buildPlacements(counts) {
  const placements = [];
  for (const grade of GRADES) {
    for (const sectionLetter of SECTIONS) {
      const section = `${grade.number} - ${sectionLetter}`;
      const key = `${grade.grade}|${section}`;
      const enrolled = counts.get(key) || 0;
      const available = Math.max(0, CAPACITY - enrolled);
      const add = Math.min(available, TARGET_COUNT - placements.length);
      for (let i = 0; i < add; i++) placements.push({ gradeLevel: grade.grade, section, department: grade.department });
      if (placements.length === TARGET_COUNT) return placements;
    }
  }
  return placements;
}

function chooseSubjectSet(gradeNumber) {
  return gradeNumber <= 10 ? JHS_SUBJECTS : SHS_SUBJECTS;
}

function createSchedulePlan(existingSchedules, faculty, subjectAssignments) {
  const teacherBusy = new Set();
  const sectionBusy = new Set();
  const teacherLoad = new Map(faculty.map(f => [idOf(f._id), 0]));

  for (const s of existingSchedules) {
    const fid = idOf(s.faculty);
    const grade = s.gradeLevel || s.yearLevel || '';
    const section = s.section || '';
    const start = parseTime(s.startTime);
    let end = parseTime(s.endTime);
    if (start === null || end === null) continue;
    if (end <= start) end += 24 * 60;
    for (const day of parseDays(s.days)) {
      for (let p = 0; p < PERIODS.length; p++) {
        const ps = parseTime(PERIODS[p][0]);
        const pe = parseTime(PERIODS[p][1]);
        if (overlaps(start, end, ps, pe)) {
          if (fid) teacherBusy.add(`${fid}|${day}|${p}`);
          if (grade && section) sectionBusy.add(`${grade}|${section}|${day}|${p}`);
        }
      }
    }
  }

  const plan = [];
  for (const assignment of subjectAssignments) {
    const candidates = faculty
      .slice()
      .sort((a, b) => {
        const loadDifference = (teacherLoad.get(idOf(a._id)) || 0) - (teacherLoad.get(idOf(b._id)) || 0);
        if (loadDifference !== 0) return loadDifference;
        const aDepartmentMatch = String(a.department || '').toLowerCase() === assignment.department.toLowerCase() ? 1 : 0;
        const bDepartmentMatch = String(b.department || '').toLowerCase() === assignment.department.toLowerCase() ? 1 : 0;
        if (aDepartmentMatch !== bDepartmentMatch) return bDepartmentMatch - aDepartmentMatch;
        const subjectName = String(assignment.subjectName || '').toLowerCase();
        const aSubjectMatch = a.subject && subjectName.includes(String(a.subject).toLowerCase()) ? 1 : 0;
        const bSubjectMatch = b.subject && subjectName.includes(String(b.subject).toLowerCase()) ? 1 : 0;
        return bSubjectMatch - aSubjectMatch;
      });

    let chosen = null;
    for (const teacher of candidates) {
      const fid = idOf(teacher._id);
      for (let d = 0; d < DAYS.length && !chosen; d++) {
        for (let p = 0; p < PERIODS.length; p++) {
          const day = DAYS[d];
          const tKey = `${fid}|${day}|${p}`;
          const sKey = `${assignment.gradeLevel}|${assignment.section}|${day}|${p}`;
          if (!teacherBusy.has(tKey) && !sectionBusy.has(sKey)) {
            chosen = { teacher, day, period: p, tKey, sKey };
            break;
          }
        }
      }
      if (chosen) break;
    }
    if (!chosen) throw new Error(`Could not find a conflict-free schedule slot for ${assignment.gradeLevel} ${assignment.section} ${assignment.subjectName}.`);

    teacherBusy.add(chosen.tKey);
    sectionBusy.add(chosen.sKey);
    teacherLoad.set(idOf(chosen.teacher._id), (teacherLoad.get(idOf(chosen.teacher._id)) || 0) + 1);
    plan.push({ ...assignment, faculty: chosen.teacher._id, days: chosen.day, startTime: PERIODS[chosen.period][0], endTime: PERIODS[chosen.period][1], room: `DEMO Room ${String((assignment.gradeNumber * 2 + (assignment.section.endsWith('B') ? 2 : 1))).padStart(2, '0')}` });
  }
  return { plan, teacherLoad: Object.fromEntries(teacherLoad) };
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing from server/.env.');
  if (!fs.existsSync(ASSET_DIR)) throw new Error(`Face asset folder not found: ${ASSET_DIR}`);
  const imageFiles = Array.from({ length: TARGET_COUNT }, (_, i) => path.join(ASSET_DIR, `${SCHOOL_ID_PREFIX}${String(i + 1).padStart(4, '0')}.jpg`));
  const missing = imageFiles.filter(file => !fs.existsSync(file));
  if (missing.length) throw new Error(`Missing ${missing.length} face fixture files. Expected exactly 450 in ${ASSET_DIR}.`);

  if (IS_APPLY && fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest already exists at ${MANIFEST_PATH}. Run rollbackDemo450.js first or inspect the prior partial seed; refusing to duplicate.`);
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  const academicYear = await AcademicYear.findOne({ status: 'Active' }).sort({ startDate: -1 }).lean();
  if (!academicYear) throw new Error('No active academic year found.');
  let semester = await Semester.findOne({ academicYear: academicYear._id, name: '1st Semester', status: 'Active' }).lean();
  if (!semester) semester = await Semester.findOne({ academicYear: academicYear._id, name: '1st Semester' }).sort({ startDate: -1 }).lean();
  if (!semester) throw new Error('1st Semester was not found for the active academic year.');

  const faculty = await User.find({ role: 'faculty', status: 'active' }).select('firstName middleName lastName fullName schoolId department subject status').lean();
  if (!faculty.length) throw new Error('No active faculty accounts found.');

  const priorDemoUsers = await User.countDocuments({ isDemo: true, demoSource: TAG });
  const priorPrefixUsers = await User.countDocuments({ schoolId: new RegExp(`^${SCHOOL_ID_PREFIX}`) });
  if (priorDemoUsers || priorPrefixUsers) throw new Error(`Found existing DEMO26 users (tagged=${priorDemoUsers}, prefix=${priorPrefixUsers}). Refusing to add another 450.`);

  const curriculumNames = ['DEMO450 Junior High Curriculum 2026-2027', 'DEMO450 Senior High Curriculum 2026-2027'];
  const duplicateCurricula = await Curriculum.countDocuments({ name: { $in: curriculumNames } });
  if (duplicateCurricula) throw new Error('A DEMO450 curriculum already exists. Roll back the previous demo seed before retrying.');

  const enrollmentRows = await Enrollment.find({ academicYear: academicYear._id, semester: semester._id, status: 'Enrolled' }).select('gradeLevel section').lean();
  const counts = new Map();
  for (const row of enrollmentRows) {
    const key = `${row.gradeLevel}|${row.section}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const placements = buildPlacements(counts);
  if (placements.length !== TARGET_COUNT) {
    const available = GRADES.reduce((sum, g) => sum + SECTIONS.reduce((s, letter) => {
      const key = `${g.grade}|${g.number} - ${letter}`;
      return s + Math.max(0, CAPACITY - (counts.get(key) || 0));
    }, 0), 0);
    throw new Error(`Only ${available} seats are available across the 12 target sections; cannot add all 450 without exceeding capacity.`);
  }

  const subjectAssignments = [];
  for (const grade of GRADES) {
    for (const sectionLetter of SECTIONS) {
      const section = `${grade.number} - ${sectionLetter}`;
      for (const subject of chooseSubjectSet(grade.number)) {
        subjectAssignments.push({
          gradeLevel: grade.grade,
          gradeNumber: grade.number,
          section,
          department: grade.department,
          subjectName: subject.name,
          subjectCode: `D450-G${grade.number}-${subject.code}`,
          subjectKey: `${grade.number}-${subject.code}`,
        });
      }
    }
  }

  const existingSchedules = await Schedule.find({ academicYear: academicYear._id, semester: semester._id }).select('faculty gradeLevel yearLevel section days startTime endTime').lean();
  const schedulePlan = createSchedulePlan(existingSchedules, faculty, subjectAssignments);
  const activeFacultySummary = faculty.map(f => ({ id: idOf(f._id), name: f.fullName || `${f.firstName || ''} ${f.lastName || ''}`.trim(), department: f.department || '' }));

  const distribution = GRADES.flatMap(g => SECTIONS.map(letter => {
    const section = `${g.number} - ${letter}`;
    const key = `${g.grade}|${section}`;
    return { grade: g.grade, section, existing: counts.get(key) || 0, adding: placements.filter(p => p.gradeLevel === g.grade && p.section === section).length, after: (counts.get(key) || 0) + placements.filter(p => p.gradeLevel === g.grade && p.section === section).length, capacity: CAPACITY };
  }));

  const planReport = {
    mode: IS_APPLY ? 'LIVE APPLY REQUESTED - confirmation still required' : 'DRY RUN - READ ONLY',
    academicYear: academicYear.year,
    semester: semester.name,
    activeFaculty: activeFacultySummary,
    studentsToAdd: placements.length,
    faceImagesToUpload: imageFiles.length,
    curriculaToCreate: 2,
    learningAreasToCreate: 12,
    curriculumSubjectsToCreate: 36,
    schedulesToCreate: schedulePlan.plan.length,
    distribution,
    teacherScheduleLoad: schedulePlan.teacherLoad,
    syntheticImageDisclosure: '450 distinct image files generated from 10 AI-created synthetic base portraits with mild augmentations (45 variants per base). They are performance fixtures, not 450 unique biometric identities and must not be used to validate recognition accuracy.',
    safety: 'Synthetic demo students are tagged and excluded from live identity matching by the supplied Android patch.'
  };
  console.log(JSON.stringify(planReport, null, 2));

  if (!IS_APPLY) {
    console.log('\nDRY RUN ONLY. No database or Cloudinary records were changed.');
    return;
  }
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary credentials are missing from .env. No seed writes have started.');
  }
  cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });

  const confirmation = await ask(`\nYou are connected to the configured MongoDB database for ${academicYear.year}. Type SEED 450 DEMO STUDENTS to upload 450 synthetic faces and create demo records: `);
  if (confirmation !== 'SEED 450 DEMO STUDENTS') {
    console.log('Confirmation did not match. No writes were performed.');
    return;
  }

  const manifest = {
    source: TAG,
    createdAt: new Date().toISOString(),
    academicYearId: idOf(academicYear._id),
    semesterId: idOf(semester._id),
    curriculumIds: [], learningAreaIds: [], curriculumSubjectIds: [], scheduleIds: [], userIds: [], enrollmentIds: [], cloudinaryPublicIds: [],
  };
  saveManifest(manifest);

  try {
    const jhsCurriculum = await Curriculum.create({ name: curriculumNames[0], department: 'Junior High School', effectiveYear: 2026, expirationYear: null, status: 'Active' });
    manifest.curriculumIds.push(idOf(jhsCurriculum._id)); saveManifest(manifest);
    const shsCurriculum = await Curriculum.create({ name: curriculumNames[1], department: 'Senior High School', effectiveYear: 2026, expirationYear: null, status: 'Active' });
    manifest.curriculumIds.push(idOf(shsCurriculum._id)); saveManifest(manifest);
    const curriculumByDepartment = { 'Junior High School': jhsCurriculum, 'Senior High School': shsCurriculum };

    const learningAreaMap = new Map();
    for (const dept of ['Junior High School', 'Senior High School']) {
      const gradeList = GRADES.filter(g => g.department === dept);
      const subjectDefs = dept === 'Junior High School' ? JHS_SUBJECTS : SHS_SUBJECTS;
      for (const subject of subjectDefs) {
        const subdocs = gradeList.map(g => ({
          name: `${subject.name} - Grade ${g.number}`,
          code: `D450-G${g.number}-${subject.code}`,
          units: subject.units,
          description: 'Synthetic subject for ClassTsek demonstration data.',
          status: 'Active',
        }));
        const area = await LearningArea.create({
          name: `DEMO450 - ${subject.area} (${dept === 'Junior High School' ? 'JHS' : 'SHS'})`,
          department: dept,
          description: 'DEMO450 synthetic learning area. Created only for the ClassTsek load demonstration.',
          status: 'Active',
          subjects: subdocs,
        });
        manifest.learningAreaIds.push(idOf(area._id)); saveManifest(manifest);
        for (const grade of gradeList) {
          const subdoc = area.subjects.find(x => x.code === `D450-G${grade.number}-${subject.code}`);
          learningAreaMap.set(`${grade.number}-${subject.code}`, { area, subdoc });
        }
      }
    }

    const curriculumSubjectMap = new Map();
    for (const grade of GRADES) {
      for (const subject of chooseSubjectSet(grade.number)) {
        const key = `${grade.number}-${subject.code}`;
        const mapped = learningAreaMap.get(key);
        const curriculumSubject = await CurriculumSubject.create({
          curriculum: curriculumByDepartment[grade.department]._id,
          gradeLevel: grade.grade,
          learningArea: mapped.area._id,
          subjectId: mapped.subdoc._id,
          subjectCode: `D450-G${grade.number}-${subject.code}`,
          subjectName: subject.name,
          description: 'Synthetic DEMO450 subject used for system demonstration and load testing.',
          units: subject.units,
          status: 'Active',
        });
        curriculumSubjectMap.set(key, curriculumSubject);
        manifest.curriculumSubjectIds.push(idOf(curriculumSubject._id)); saveManifest(manifest);
      }
    }

    for (const item of schedulePlan.plan) {
      const subjectCode = item.subjectCode;
      const subjectDoc = curriculumSubjectMap.get(`${item.gradeNumber}-${subjectCode.replace(`D450-G${item.gradeNumber}-`, '')}`);
      if (!subjectDoc) throw new Error(`Missing CurriculumSubject for ${item.subjectCode}`);
      const schedule = await Schedule.create({
        curriculumSubject: subjectDoc._id,
        subject: item.subjectName,
        subjectCode: item.subjectCode,
        section: item.section,
        faculty: item.faculty,
        room: item.room,
        days: item.days,
        startTime: item.startTime,
        endTime: item.endTime,
        course: item.department,
        yearLevel: item.gradeLevel,
        department: item.department,
        gradeLevel: item.gradeLevel,
        academicYear: academicYear._id,
        semester: semester._id,
        capacity: CAPACITY,
      });
      manifest.scheduleIds.push(idOf(schedule._id)); saveManifest(manifest);
    }

    const uploaded = new Map();
    console.log(`\nUploading ${TARGET_COUNT} authenticated synthetic face fixtures to Cloudinary (4 at a time)...`);
    await mapLimit(imageFiles, 4, async (file, index) => {
      const schoolId = `${SCHOOL_ID_PREFIX}${String(index + 1).padStart(4, '0')}`;
      const publicId = `classtsek/demo-450-face-samples/${schoolId}`;
      const result = await cloudinary.uploader.upload(file, {
        public_id: publicId,
        resource_type: 'image',
        type: 'authenticated',
        overwrite: false,
      });
      uploaded.set(schoolId, result);
      manifest.cloudinaryPublicIds.push(result.public_id);
      saveManifest(manifest);
      if ((index + 1) % 25 === 0 || index === TARGET_COUNT - 1) console.log(`Cloudinary uploads completed: ${index + 1}/${TARGET_COUNT}`);
    });

    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 10);
    const studentDocs = placements.map((placement, i) => {
      const user = createStudentIdentity(i, placement);
      const cloud = uploaded.get(user.schoolId);
      if (!cloud) throw new Error(`Missing Cloudinary upload for ${user.schoolId}`);
      const publicId = cloud.public_id;
      user.curriculum = curriculumByDepartment[placement.department]._id;
      user.profileImage = cloudinary.url(publicId, { resource_type: 'image', type: 'authenticated', secure: true, sign_url: true });
      user.password = passwordHash;
      user.faceSamples = [{
        imagePath: `uploads/face-samples/demo-450/${user.schoolId}.jpg`,
        source: 'upload',
        createdAt: new Date(),
        cloudinaryPublicId: publicId,
        cloudinaryResourceType: 'image',
        cloudinaryType: 'authenticated',
      }];
      return user;
    });

    console.log('\nCreating 450 demo student accounts...');
    const createdUsers = [];
    for (let i = 0; i < studentDocs.length; i += 25) {
      const batch = await User.insertMany(studentDocs.slice(i, i + 25), { ordered: true });
      createdUsers.push(...batch);
      manifest.userIds.push(...batch.map(u => idOf(u._id)));
      saveManifest(manifest);
      console.log(`Student accounts created: ${createdUsers.length}/${TARGET_COUNT}`);
    }

    const studentIdBySchoolId = new Map(createdUsers.map(u => [u.schoolId, u._id]));
    const enrollmentDocs = placements.map((placement, i) => {
      const student = createdUsers[i];
      const grade = GRADES.find(g => g.grade === placement.gradeLevel);
      return {
        student: studentIdBySchoolId.get(student.schoolId),
        academicYear: academicYear._id,
        semester: semester._id,
        curriculum: curriculumByDepartment[grade.department]._id,
        gradeLevel: placement.gradeLevel,
        section: placement.section,
        status: 'Enrolled',
      };
    });
    console.log('\nCreating 450 enrollment records...');
    for (let i = 0; i < enrollmentDocs.length; i += 50) {
      const batch = await Enrollment.insertMany(enrollmentDocs.slice(i, i + 50), { ordered: true });
      manifest.enrollmentIds.push(...batch.map(e => idOf(e._id)));
      saveManifest(manifest);
      console.log(`Enrollments created: ${manifest.enrollmentIds.length}/${TARGET_COUNT}`);
    }

    const [demoUsers, demoEnrollments] = await Promise.all([
      User.countDocuments({ isDemo: true, demoSource: TAG }),
      Enrollment.countDocuments({ _id: { $in: manifest.enrollmentIds } }),
    ]);
    const finalCounts = new Map();
    for (const row of await Enrollment.aggregate([
      { $match: { academicYear: academicYear._id, semester: semester._id, status: 'Enrolled' } },
      { $group: { _id: { gradeLevel: '$gradeLevel', section: '$section' }, count: { $sum: 1 } } },
    ])) finalCounts.set(`${row._id.gradeLevel}|${row._id.section}`, row.count);

    manifest.completedAt = new Date().toISOString();
    manifest.verified = { demoUsers, demoEnrollments, cloudinaryFaceSamples: manifest.cloudinaryPublicIds.length, schedules: manifest.scheduleIds.length };
    saveManifest(manifest);
    console.log('\nDEMO SEED COMPLETED. Existing records were not edited.');
    console.log(JSON.stringify({
      demoStudentsCreated: demoUsers,
      demoEnrollmentsCreated: demoEnrollments,
      cloudinaryFaceSamplesUploaded: manifest.cloudinaryPublicIds.length,
      demoCurriculaCreated: manifest.curriculumIds.length,
      demoLearningAreasCreated: manifest.learningAreaIds.length,
      demoSubjectsCreated: manifest.curriculumSubjectIds.length,
      demoSchedulesCreated: manifest.scheduleIds.length,
      enrolledBySection: distribution.map(d => ({ grade: d.grade, section: d.section, enrolledAfterSeed: finalCounts.get(`${d.grade}|${d.section}`) || 0, capacity: CAPACITY })),
      remainingSeats: distribution.reduce((sum, d) => sum + Math.max(0, CAPACITY - (finalCounts.get(`${d.grade}|${d.section}`) || 0)), 0),
      manifest: MANIFEST_PATH,
      note: 'Synthetic demo images are performance fixtures and are excluded from actual face matching by the Android patch.'
    }, null, 2));
  } catch (error) {
    console.error('\nSEED STOPPED. Some demo-only records/assets may have been created.');
    console.error('Use rollbackDemo450.js after inspecting the manifest to remove only tagged demo data.');
    console.error(error.stack || error.message);
    throw error;
  }
}

if (require.main === module) {
  main()
    .catch(err => { console.error('\nSEED ERROR:', err.message); process.exitCode = 1; })
    .finally(async () => { if (mongoose.connection.readyState !== 0) await mongoose.disconnect(); });
}

module.exports = { buildPlacements, createSchedulePlan, parseDays, parseTime, overlaps, GRADES, SECTIONS, PERIODS };
