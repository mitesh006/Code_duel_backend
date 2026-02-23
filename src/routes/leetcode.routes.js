const express = require("express");
const router = express.Router();
const leetcodeController = require("../controllers/leetcode.controller");
const { authenticate } = require("../middlewares/auth.middleware");

router.get(
  "/profile/:username",
  authenticate,
  leetcodeController.getUserProfile
);

router.get("/test/:username", authenticate, leetcodeController.testConnection);

router.get(
  "/problem/:titleSlug",
  authenticate,
  leetcodeController.getProblemMetadata
);

module.exports = router;
