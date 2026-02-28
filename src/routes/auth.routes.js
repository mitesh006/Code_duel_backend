const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { authenticate } = require("../middlewares/auth.middleware");

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  "/register",
  authController.validateRegister,
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post("/login", authController.validateLogin, authController.login);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request a password reset link
 * @access  Public
 */
router.post(
  "/forgot-password",
  authController.validateForgotPassword,
  authController.forgotPassword
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using a valid reset token
 * @access  Public
 */
router.post(
  "/reset-password",
  authController.validateResetPassword,
  authController.resetPassword
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/profile", authenticate, authController.getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  "/profile",
  authenticate,
  authController.validateUpdateProfile,
  authController.updateProfile
);

module.exports = router;
