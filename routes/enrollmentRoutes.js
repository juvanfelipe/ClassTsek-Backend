const express = require("express");

const router = express.Router();

const Enrollment = require("../models/Enrollment");
const CurriculumSubject = require("../models/CurriculumSubject");

// =====================================================
// CREATE
// =====================================================

router.post("/", async (req, res) => {
    try {

        const {
            student,
            academicYear,
            semester,
            curriculum,
            gradeLevel,
            section,
        } = req.body;

        if (
            !student ||
            !academicYear ||
            !semester ||
            !curriculum ||
            !gradeLevel
        ) {
            return res.status(400).json({
                message: "Missing required fields.",
            });
        }

        const exists =
            await Enrollment.findOne({
                student,
                academicYear,
                semester,
            });

        if (exists) {
            return res.status(409).json({
                message:
                    "Student is already enrolled for this academic year and semester.",
            });
        }

        const enrollment =
            await Enrollment.create({
                student,
                academicYear,
                semester,
                curriculum,
                gradeLevel,
                section:
                    section || "Unassigned",
                status: "Enrolled",
            });

        res.status(201).json(enrollment);

    } catch (err) {

        console.error(
            "CREATE ENROLLMENT:",
            err
        );

        res.status(500).json({
            message: err.message,
        });
    }
});

// =====================================================
// GET ALL
// =====================================================

router.get("/", async (req, res) => {
    try {

        const data =
            await Enrollment.find()
                .populate(
                    "student",
                    "firstName middleName lastName schoolId gradeLevel section"
                )
                .populate("academicYear")
                .populate("semester")
                .populate("curriculum");

        res.json(data);

    } catch (err) {

        console.error(
            "GET ALL ENROLLMENTS:",
            err
        );

        res.status(500).json({
            message: err.message,
        });
    }
});

// =====================================================
// GET ENROLLMENT SUBJECTS
// =====================================================

router.get(
    "/:id/subjects",
    async (req, res) => {

        try {

            const enrollment =
                await Enrollment.findById(
                    req.params.id
                )
                    .populate("student")
                    .populate("academicYear")
                    .populate("semester")
                    .populate("curriculum");

            // ---------------------------------------------
            // ENROLLMENT NOT FOUND
            // ---------------------------------------------

            if (!enrollment) {

                return res.status(404).json({
                    message:
                        "Enrollment not found.",
                });
            }

            // ---------------------------------------------
            // CURRICULUM REFERENCE CHECK
            // ---------------------------------------------

            if (!enrollment.curriculum) {

                console.error(
                    "ENROLLMENT HAS INVALID CURRICULUM:",
                    enrollment._id
                );

                return res.status(400).json({
                    message:
                        "This enrollment has no valid curriculum reference.",
                });
            }

            // ---------------------------------------------
            // GET CURRICULUM ID SAFELY
            // ---------------------------------------------

            const curriculumId =
                enrollment.curriculum._id;

            // ---------------------------------------------
            // GET SUBJECTS
            // ---------------------------------------------

            const subjects =
                await CurriculumSubject.find({
                    curriculum: curriculumId,
                    gradeLevel:
                        enrollment.gradeLevel,
                    status: "Active",
                })
                    .populate("learningArea");

            // ---------------------------------------------
            // RESPONSE
            // ---------------------------------------------

            return res.json({
                enrollment,
                curriculum:
                    enrollment.curriculum,
                gradeLevel:
                    enrollment.gradeLevel,
                section:
                    enrollment.section,
                subjects,
            });

        } catch (err) {

            console.error(
                "GET ENROLLMENT SUBJECTS:",
                err
            );

            return res.status(500).json({
                message: err.message,
            });
        }
    }
);

// =====================================================
// UPDATE STATUS
// =====================================================

router.patch(
    "/:id/status",
    async (req, res) => {

        try {

            const updated =
                await Enrollment.findByIdAndUpdate(
                    req.params.id,
                    {
                        status:
                            req.body.status,
                    },
                    {
                        new: true,
                        runValidators: true,
                    }
                );

            if (!updated) {

                return res.status(404).json({
                    message:
                        "Enrollment not found.",
                });
            }

            res.json(updated);

        } catch (err) {

            console.error(
                "UPDATE ENROLLMENT STATUS:",
                err
            );

            res.status(500).json({
                message: err.message,
            });
        }
    }
);

// =====================================================
// MY ENROLLMENT
// =====================================================

router.get(
    "/my/:studentId",
    async (req, res) => {

        try {

            const enrollments =
                await Enrollment.find({
                    student:
                        req.params.studentId,
                })
                    .populate("academicYear")
                    .populate("semester")
                    .populate("curriculum")
                    .populate(
                        "student",
                        "firstName lastName schoolId"
                    );

            const result =
                await Promise.all(

                    enrollments.map(
                        async (enrollment) => {

                            // ---------------------------------
                            // INVALID CURRICULUM REFERENCE
                            // ---------------------------------

                            if (
                                !enrollment.curriculum
                            ) {

                                return {
                                    enrollment,
                                    subjects: [],
                                };
                            }

                            // ---------------------------------
                            // GET SUBJECTS
                            // ---------------------------------

                            const subjects =
                                await CurriculumSubject.find({
                                    curriculum:
                                        enrollment
                                            .curriculum
                                            ._id,

                                    gradeLevel:
                                        enrollment.gradeLevel,

                                    status: "Active",
                                })
                                    .populate(
                                        "learningArea"
                                    );

                            return {
                                enrollment,
                                subjects,
                            };
                        }
                    )
                );

            res.json(result);

        } catch (err) {

            console.error(
                "MY ENROLLMENT:",
                err
            );

            res.status(500).json({
                message: err.message,
            });
        }
    }
);

module.exports = router;