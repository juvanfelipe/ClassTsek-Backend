const express = require("express");

const router = express.Router();

const Notification = require("../models/Notification");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

// ================= GET MY NOTIFICATIONS =================

router.get(
  "/",
  verifyToken,
  async (req, res) => {
    try {
      const notifications =
  await Notification.find({
    recipientId: req.user.id,
  })
    .populate(
      "relatedStudentId",
      "firstName middleName lastName schoolId"
    )
    .populate({
      path: "relatedAttendanceId",
      populate: {
        path: "scheduleId",
        populate: {
          path: "faculty",
          select:
            "firstName middleName lastName",
        },
      },
    })
    .sort({
      createdAt: -1,
    });

      res.json(notifications);
    } catch (error) {
      console.error(
        "GET NOTIFICATIONS:",
        error
      );

      res.status(500).json({
        message:
          "Unable to load notifications.",
      });
    }
  }
);

// ================= UNREAD COUNT =================

router.get(
  "/unread-count",
  verifyToken,
  async (req, res) => {
    try {
      const count =
        await Notification.countDocuments({
          recipientId: req.user.id,
          isRead: false,
        });

      res.json({ count });
    } catch (error) {
      console.error(
        "UNREAD NOTIFICATIONS:",
        error
      );

      res.status(500).json({
        message:
          "Unable to get unread notification count.",
      });
    }
  }
);

// ================= MARK AS READ =================

router.put(
  "/:id/read",
  verifyToken,
  async (req, res) => {
    try {
      const notification =
        await Notification.findOneAndUpdate(
          {
            _id: req.params.id,
            recipientId: req.user.id,
          },
          {
            $set: {
              isRead: true,
              readAt: new Date(),
            },
          },
          { new: true }
        );

      if (!notification) {
        return res.status(404).json({
          message:
            "Notification not found.",
        });
      }

      res.json(notification);
    } catch (error) {
      console.error(
        "MARK NOTIFICATION READ:",
        error
      );

      res.status(500).json({
        message:
          "Unable to update notification.",
      });
    }
  }
);

// ================= MARK ALL AS READ =================

router.put(
  "/read-all",
  verifyToken,
  async (req, res) => {
    try {
      await Notification.updateMany(
        {
          recipientId: req.user.id,
          isRead: false,
        },
        {
          $set: {
            isRead: true,
            readAt: new Date(),
          },
        }
      );

      res.json({
        message:
          "All notifications marked as read.",
      });
    } catch (error) {
      console.error(
        "MARK ALL READ:",
        error
      );

      res.status(500).json({
        message:
          "Unable to update notifications.",
      });
    }
  }
);

module.exports = router;