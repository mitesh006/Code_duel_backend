const express = require("express");
const router = express.Router();
const challengeController = require("../controllers/challenge.controller");
const { authenticate } = require("../middlewares/auth.middleware");

/**
 * @route   POST /api/challenges
 * @desc    Create a new challenge
 * @access  Private
 */
router.post(
  "/",
  authenticate,
  challengeController.validateCreateChallenge,
  challengeController.createChallenge
);

/**
 * @route   POST /api/challenges/join-by-code
 * @desc    Join a challenge using an invite code
 * @access  Private
 */
router.post(
  "/join-by-code",
  authenticate,
  challengeController.joinByInviteCode
);

/**
 * @route   GET /api/challenges
 * @desc    Get all challenges for current user
 * @access  Private
 */
router.get("/", authenticate, challengeController.getUserChallenges);

/**
 * @route   GET /api/challenges/:id
 * @desc    Get challenge by ID
 * @access  Private
 */
router.get("/:id", authenticate, challengeController.getChallengeById);

/**
 * @route   POST /api/challenges/:id/join
 * @desc    Join a challenge
 * @access  Private
 */
router.post("/:id/join", authenticate, challengeController.joinChallenge);

/**
 * @route   POST /api/challenges/:id/invite
 * @desc    Generate an invite code for a challenge (owner only)
 * @access  Private
 */
router.post(
  "/:id/invite",
  authenticate,
  challengeController.validateGenerateInvite,
  challengeController.generateInviteCode
);

/**
 * @route   PATCH /api/challenges/:id/status
 * @desc    Update challenge status (owner only)
 * @access  Private
 */
router.patch(
  "/:id/status",
  authenticate,
  challengeController.updateChallengeStatus
);

module.exports = router;
