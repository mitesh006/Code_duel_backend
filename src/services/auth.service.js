const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { prisma } = require("../config/prisma");
const { config } = require("../config/env");
const { generateToken } = require("../utils/jwt");
const { AppError } = require("../middlewares/error.middleware");
const logger = require("../utils/logger");
const { sendWelcomeEmail, sendPasswordResetEmail } = require("./email.service");

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @returns {Object} User object and JWT token
 */
const register = async (userData) => {
  const { email, username, password, leetcodeUsername } = userData;

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
  });

  if (existingUser) {
    if (existingUser.email === email) {
      throw new AppError("Email already registered", 400);
    }
    if (existingUser.username === username) {
      throw new AppError("Username already taken", 400);
    }
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
      leetcodeUsername: leetcodeUsername || null,
    },
    select: {
      id: true,
      email: true,
      username: true,
      leetcodeUsername: true,
      createdAt: true,
    },
  });

  // Generate JWT token
  const token = generateToken({ userId: user.id });

  logger.info(`New user registered: ${user.username} (${user.email})`);

  // Send welcome email (non-blocking)
  sendWelcomeEmail(user.email, user.username).catch((err) => {
    logger.error(`Failed to send welcome email: ${err.message}`);
  });

  return {
    user,
    token,
  };
};

/**
 * Login user
 * @param {string} emailOrUsername - Email or username
 * @param {string} password - User password
 * @returns {Object} User object and JWT token
 */
const login = async (emailOrUsername, password) => {
  // Find user by email or username
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
    },
  });

  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new AppError("Invalid credentials", 401);
  }

  // Generate JWT token
  const token = generateToken({ userId: user.id });

  logger.info(`User logged in: ${user.username}`);

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      leetcodeUsername: user.leetcodeUsername,
      createdAt: user.createdAt,
    },
    token,
  };
};

/**
 * Get user profile
 * @param {string} userId - User ID
 * @returns {Object} User profile
 */
const getProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      leetcodeUsername: true,
      createdAt: true,
      _count: {
        select: {
          ownedChallenges: true,
          memberships: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} updateData - Data to update
 * @returns {Object} Updated user profile
 */
const updateProfile = async (userId, updateData) => {
  const { leetcodeUsername, currentPassword, newPassword } = updateData;

  // If changing password, verify current password
  if (newPassword) {
    if (!currentPassword) {
      throw new AppError("Current password is required", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isPasswordValid) {
      throw new AppError("Current password is incorrect", 401);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        leetcodeUsername:
          leetcodeUsername !== undefined ? leetcodeUsername : undefined,
      },
      select: {
        id: true,
        email: true,
        username: true,
        leetcodeUsername: true,
        updatedAt: true,
      },
    });

    logger.info(`User profile updated: ${updatedUser.username}`);

    return updatedUser;
  }

  // Update without password change
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      leetcodeUsername:
        leetcodeUsername !== undefined ? leetcodeUsername : undefined,
    },
    select: {
      id: true,
      email: true,
      username: true,
      leetcodeUsername: true,
      updatedAt: true,
    },
  });

  logger.info(`User profile updated: ${updatedUser.username}`);

  return updatedUser;
};

/**
 * Request password reset email
 * @param {string} email - User email
 * @returns {Object} Generic response
 */
const forgotPassword = async (email) => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      username: true,
    },
  });

  if (!user) {
    logger.info(`Password reset requested for non-existent email: ${email}`);
    return {
      message:
        "If an account with that email exists, a password reset link has been sent.",
    };
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiryDate = new Date(
    Date.now() + config.passwordResetTokenExpiryMinutes * 60 * 1000
  );

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpiry: expiryDate,
    },
  });

  const resetLink = `${config.appBaseUrl}/reset-password?token=${rawToken}`;

  const emailResult = await sendPasswordResetEmail(
    user.email,
    user.username,
    resetLink,
    config.passwordResetTokenExpiryMinutes
  );

  if (!emailResult.success) {
    logger.error(
      `Password reset email failed for ${user.email}: ${emailResult.reason}`
    );
  }

  return {
    message:
      "If an account with that email exists, a password reset link has been sent.",
  };
};

/**
 * Reset user password using token
 * @param {string} token - Raw reset token
 * @param {string} newPassword - New password
 * @returns {Object} Success message
 */
const resetPassword = async (token, newPassword) => {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findFirst({
    where: {
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpiry: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      username: true,
    },
  });

  if (!user) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordResetTokenHash: null,
      passwordResetTokenExpiry: null,
    },
  });

  logger.info(`Password reset successful for user: ${user.username}`);

  return {
    message: "Password reset successful",
  };
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  forgotPassword,
  resetPassword,
};
