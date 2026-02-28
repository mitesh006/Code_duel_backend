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
  const { date } = req.query;

  const targetDate = date ? new Date(date) : new Date();
  const submissions = await leetcodeService.fetchSubmissionsForDate(
    username,
    targetDate
  );

  res.status(200).json({
    success: true,
    message: "Connection test successful",
    data: {
      username,
      date: targetDate.toISOString(),
      submissionsFound: submissions.length,
      submissions
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

/**
 * Test date filtering for submissions
 * GET /api/leetcode/submissions/:username
 */
const getSubmissionsForDate = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({
      success: false,
      message: "Date parameter is required (format: YYYY-MM-DD)",
    });
  }

  const targetDate = new Date(date);
  const submissions = await leetcodeService.fetchSubmissionsForDate(
    username,
    targetDate
  );

  const enriched = await leetcodeService.enrichSubmissionsWithMetadata(submissions);

  res.status(200).json({
    success: true,
    data: {
      username,
      date: targetDate.toISOString().split('T')[0],
      submissionsCount: enriched.length,
      submissions: enriched,
    },
  });
});

module.exports = {
  getUserProfile,
  testConnection,
  getProblemMetadata,
  getSubmissionsForDate,
};
