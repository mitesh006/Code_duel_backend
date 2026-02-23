const leetcodeService = require("../services/leetcode.service");
const { asyncHandler } = require("../middlewares/error.middleware");

/**
 * Fetch user's LeetCode profile
 * GET /api/leetcode/profile/:username
 */
const getUserProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const profile = await leetcodeService.fetchUserProfile(username);

  res.status(200).json({
    success: true,
    data: profile,
  });
});

/**
 * Test LeetCode connection (for debugging)
 * GET /api/leetcode/test/:username
 */
const testConnection = asyncHandler(async (req, res) => {
  const { username } = req.params;

  // Fetch recent submissions
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const submissions = await leetcodeService.fetchSubmissionsForDate(
    username,
    yesterday
  );

  res.status(200).json({
    success: true,
    message: "Connection test successful",
    data: {
      username,
      submissionsFound: submissions.length,
      submissions: submissions// Return first 5 for testing
    },
  });
});

/**
 * Fetch problem metadata (for admin/debugging)
 * GET /api/leetcode/problem/:titleSlug
 */
const getProblemMetadata = asyncHandler(async (req, res) => {
  const { titleSlug } = req.params;
  const metadata = await leetcodeService.fetchProblemMetadata(titleSlug);

  if (!metadata) {
    return res.status(404).json({
      success: false,
      message: `Problem not found: ${titleSlug}`,
    });
  }

  res.status(200).json({
    success: true,
    data: metadata,
  });
});

module.exports = {
  getUserProfile,
  testConnection,
  getProblemMetadata,
};
