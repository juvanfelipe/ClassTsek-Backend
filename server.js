const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

// ================= ROUTES =================

const curriculumRoutes = require("./routes/CurriculumRoutes");
const academicYearRoutes = require("./routes/AcademicYearRoutes");
const semesterRoutes = require("./routes/SemesterRoutes");
const facultyRoutes = require("./routes/facultyRoutes");
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const scheduleRoutes = require("./routes/scheduleRoutes");
const enrollmentRoutes = require("./routes/enrollmentRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const learningAreaRoutes = require("./routes/LearningAreaRoutes");
const curriculumSubjectRoutes = require("./routes/CurriculumSubjectRoutes");
const faceEnrollmentRoutes = require("./routes/faceEnrollmentRoutes");

const app = express();
const server = http.createServer(app);

// ================= SOCKET.IO =================

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

app.set("io", io);

io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("joinUser", (userId) => {
        if (userId) {
            socket.join(`user_${userId}`);

            console.log(
                `User ${userId} joined notification room.`
            );
        }
    });

    socket.on("disconnect", () => {
        console.log(
            "Socket disconnected:",
            socket.id
        );
    });
});

// ================= MIDDLEWARE =================

app.use((req, res, next) => {
    res.header(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.header(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );

    res.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

app.use(express.json());

// ================= REQUEST LOGGER =================

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// ================= ROUTES =================

app.use("/api/users", userRoutes);

app.use(
    "/api/face-enrollment",
    faceEnrollmentRoutes
);

app.use("/api/auth", authRoutes);

app.use(
    "/api/attendance",
    attendanceRoutes
);

app.use(
    "/api/schedules",
    scheduleRoutes
);

app.use(
    "/api/enrollments",
    enrollmentRoutes
);

app.use(
    "/api/announcements",
    announcementRoutes
);

app.use(
    "/api/curriculums",
    curriculumRoutes
);

app.use(
    "/api/academic-years",
    academicYearRoutes
);

app.use(
    "/api/semesters",
    semesterRoutes
);

app.use(
    "/api/learning-areas",
    learningAreaRoutes
);

app.use(
    "/api/curriculum-subjects",
    curriculumSubjectRoutes
);

app.use(
    "/api/faculty",
    facultyRoutes
);

app.use(
    "/api/notifications",
    notificationRoutes
);

// ================= HEALTH / TEST =================

app.get("/", (req, res) => {
    res.status(200).send("ClassTsek API Running");
});

// ================= DATABASE =================

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log(
            "MongoDB Connected Successfully!"
        );
    })
    .catch((err) => {
        console.log(
            "MongoDB Connection Error:",
            err
        );
    });

// ================= START SERVER =================

const PORT = process.env.PORT || 5001;

server.listen(PORT, "0.0.0.0", () => {
    console.log(
        `ClassTsek server running on port ${PORT}`
    );
});