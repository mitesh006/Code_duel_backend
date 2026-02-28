const authService = require("../services/auth.service");
const { asyncHandler } = require("../middlewares/error.middleware");
const { body, validationResult } = require("express-validator");
const { sanitizeFields } = require("../middlewares/sanitization.middleware");

/**
 * Validation middleware for registration
 */
const validateRegister = [
  // Sanitize fields before validation
  sanitizeFields({
    email: { type: "email", required: true },
    username: { type: "username", required: true },
    password: { type: "password", required: true },
    leetcodeUsername: { type: "username", required: false },
  }),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email is required"),
  body("username")
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage(
      "Username must be 3-30 characters and contain only letters, numbers, and underscores"
    ),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("leetcodeUsername")
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage("LeetCode username must be 1-50 characters"),
];

/**
 * Validation middleware for login
 */
const validateLogin = [
  // Sanitize fields before validation
  sanitizeFields({
    emailOrUsername: {
      type: "string",
      required: true,
      options: { maxLength: 254 },
    },
    password: { type: "password", required: true },
  }),
  body("emailOrUsername")
    .notEmpty()
    .withMessage("Email or username is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

/**
 * Validation middleware for forgot password
 */
const validateForgotPassword = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email is required"),
];

/**
 * Validation middleware for reset password
 */
const validateResetPassword = [
  body("token").notEmpty().withMessage("Reset token is required"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters"),
];

/**
 * Register a new user
 * POST /api/auth/register
 */
const register = asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  const { email, username, password, leetcodeUsername } = req.body;

  const result = await authService.register({
    email,
    username,
    password,
    leetcodeUsername,
  });

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    data: result,
  });
});

/**
 * Login user
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  const { emailOrUsername, password } = req.body;

  const result = await authService.login(emailOrUsername, password);

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: result,
  });
});

/**
 * Get current user profile
 * GET /api/auth/profile
 */
const getProfile = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user.id);

  res.status(200).json({
    success: true,
    data: user,
  });
});

/**
 * Validation middleware for profile update
 */
const validateUpdateProfile = [
  sanitizeFields({
    leetcodeUsername: { type: "username", required: false },
    currentPassword: { type: "password", required: false },
    newPassword: { type: "password", required: false },
  }),
  body("leetcodeUsername")
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage("LeetCode username must be 1-50 characters"),
  body("currentPassword")
    .optional()
    .isLength({ min: 6 })
    .withMessage("Current password must be at least 6 characters"),
  body("newPassword")
    .optional()
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters"),
];

/**
 * Update user profile
 * PUT /api/auth/profile
 */
const updateProfile = asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  const { leetcodeUsername, currentPassword, newPassword } = req.body;

  const user = await authService.updateProfile(req.user.id, {
    leetcodeUsername,
    currentPassword,
    newPassword,
  });

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: user,
  });
});

/**
 * Request password reset
 * POST /api/auth/forgot-password
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  const { email } = req.body;
  const result = await authService.forgotPassword(email);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

/**
 * Reset password using token
 * POST /api/auth/reset-password
 */
const resetPassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  const { token, newPassword } = req.body;
  const result = await authService.resetPassword(token, newPassword);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

/**
 * Logout user and blacklist token
 * POST /api/auth/logout
 * @access  Private
 */
const logout = asyncHandler(async (req, res) => {
  // Token is already verified and stored by middleware
  const token = req.verifiedToken;
  const userId = req.user.id;

  await authService.blacklistToken(token, userId);

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  forgotPassword,
  resetPassword,
  logout,
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateUpdateProfile,
};

