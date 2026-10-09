require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./models/User");

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("\n=== FACE SAMPLE MAPPING ===\n");

    const students = await User.find({
      role: "student",
      faceSamples: { $exists: true, $ne: [] },
    })
      .select(
        "firstName middleName lastName schoolId faceEnrollmentStatus +faceSamples"
      )
      .lean();

    for (const student of students) {
      const fullName = [
        student.firstName,
        student.middleName,
        student.lastName,
      ]
        .filter(Boolean)
        .join(" ");

      console.log("----------------------------------------");
      console.log(`Student: ${fullName}`);
      console.log(`School ID: ${student.schoolId}`);
      console.log(`Status: ${student.faceEnrollmentStatus}`);
      console.log(`Samples: ${student.faceSamples?.length || 0}`);

      if (student.faceSamples?.length) {
        student.faceSamples.forEach((sample, index) => {
          console.log(`\n  Sample ${index}:`);
          console.log(`    imagePath: ${sample.imagePath}`);
          console.log(
            `    cloudinaryPublicId: ${sample.cloudinaryPublicId || "NONE"}`
          );
        });
      }

      console.log("");
    }

    console.log("========================================\n");
  } catch (error) {
    console.error("ERROR:", error);
  } finally {
    await mongoose.disconnect();
  }
}

run();