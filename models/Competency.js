const competencySchema =
new mongoose.Schema({
  curriculumSubject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CurriculumSubject",
  },

  quarter: Number,

  contentStandard: String,

  performanceStandard: String,

  learningCompetencies: [
    String,
  ],

  assessmentMethods: [
    String,
  ],
});