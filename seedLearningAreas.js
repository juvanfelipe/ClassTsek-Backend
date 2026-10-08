const mongoose = require("mongoose");
require("dotenv").config();

const LearningArea =
  require("./models/LearningArea");

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    await LearningArea.deleteMany();

    await LearningArea.insertMany([
      {
        name: "English",
        department: "Junior High School",
      },
      {
        name: "Filipino",
        department: "Junior High School",
      },
      {
        name: "Mathematics",
        department: "Junior High School",
      },
      {
        name: "Science",
        department: "Junior High School",
      },
      {
        name: "Araling Panlipunan",
        department: "Junior High School",
      },
      {
        name: "MAPEH",
        department: "Junior High School",
      },
      {
        name: "TLE",
        department: "Junior High School",
      },
      {
        name: "EsP",
        department: "Junior High School",
      },

      {
        name: "English",
        department: "Senior High School",
      },
      {
        name: "Filipino",
        department: "Senior High School",
      },
      {
        name: "Mathematics",
        department: "Senior High School",
      },
      {
        name: "Science",
        department: "Senior High School",
      },
      {
        name: "Core Subjects",
        department: "Senior High School",
      },
      {
        name: "Applied Subjects",
        department: "Senior High School",
      },
      {
        name: "Specialized Subjects",
        department: "Senior High School",
      },
    ]);

    console.log(
      "Learning Areas Seeded!"
    );

    process.exit();
  });