require("dotenv").config();

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const { v2: cloudinary } = require("cloudinary");
const User = require("./models/User");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const FACE_SAMPLES_DIR = path.join(
  __dirname,
  "uploads",
  "face-samples"
);

async function migrateFaceSamples() {
  try {
    console.log("======================================");
    console.log("ClassTsek Face Sample Migration");
    console.log("======================================\n");

    // Connect to MongoDB Atlas
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected Successfully!\n");

    // Get all users that have face samples
    const users = await User.find({
      "faceSamples.0": { $exists: true },
    }).select(
      "firstName lastName schoolId +faceSamples"
    );

    console.log(`Students found: ${users.length}`);

    let totalSamples = 0;
    let uploaded = 0;
    let missing = 0;
    let skipped = 0;

    for (const user of users) {
      console.log(
        `\nStudent: ${user.firstName} ${user.lastName} (${user.schoolId})`
      );

      for (let i = 0; i < user.faceSamples.length; i++) {
        const sample = user.faceSamples[i];

        totalSamples++;

        const relativePath = sample.imagePath;

        // Only process our existing local face-sample paths
        if (
          !relativePath ||
          relativePath.startsWith("http://") ||
          relativePath.startsWith("https://")
        ) {
          console.log(
            `  Sample ${i + 1}: SKIPPED - already appears to be remote`
          );
          skipped++;
          continue;
        }

        const filename = path.basename(relativePath);

        const localFile = path.join(
          FACE_SAMPLES_DIR,
          filename
        );

        // Check if the local file actually exists
        if (!fs.existsSync(localFile)) {
          console.log(
            `  Sample ${i + 1}: MISSING - ${filename}`
          );
          missing++;
          continue;
        }

        // Remove extension for Cloudinary public ID
        const filenameWithoutExtension = path.parse(
          filename
        ).name;

        const publicId =
          `classtsek/face-samples/${filenameWithoutExtension}`;

        console.log(
          `  Sample ${i + 1}: Uploading ${filename}...`
        );

        try {
          const result = await cloudinary.uploader.upload(
            localFile,
            {
              public_id: publicId,
              resource_type: "image",
              type: "authenticated",
              overwrite: true,
            }
          );

          // Update MongoDB directly so we don't need
          // to modify the User schema during this migration.
          await User.collection.updateOne(
            {
              _id: user._id,
              "faceSamples._id": sample._id,
            },
            {
              $set: {
                "faceSamples.$.cloudinaryPublicId":
                  result.public_id,
                "faceSamples.$.cloudinaryResourceType":
                  result.resource_type,
                "faceSamples.$.cloudinaryType":
                  result.type,
              },
            }
          );

          console.log(
            `  Sample ${i + 1}: UPLOADED ✓`
          );

          console.log(
            `    Cloudinary ID: ${result.public_id}`
          );

          uploaded++;
        } catch (uploadError) {
          console.error(
            `  Sample ${i + 1}: UPLOAD FAILED`
          );

          console.error(
            `    ${uploadError.message}`
          );
        }
      }
    }

    console.log("\n======================================");
    console.log("Migration Summary");
    console.log("======================================");
    console.log(`Students found: ${users.length}`);
    console.log(`Total DB samples: ${totalSamples}`);
    console.log(`Successfully uploaded: ${uploaded}`);
    console.log(`Missing local files: ${missing}`);
    console.log(`Skipped: ${skipped}`);
    console.log("======================================\n");

    if (missing > 0) {
      console.log(
        "NOTE: Missing files were NOT deleted from MongoDB."
      );
    }

    if (uploaded > 0) {
      console.log(
        "Cloudinary migration completed for the available files."
      );
    }

    await mongoose.disconnect();

    console.log("MongoDB connection closed.");
  } catch (error) {
    console.error("\nMIGRATION ERROR:");
    console.error(error.message);

    try {
      await mongoose.disconnect();
    } catch (_) {}

    process.exit(1);
  }
}

migrateFaceSamples();