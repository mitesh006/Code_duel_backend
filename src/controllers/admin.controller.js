const { asyncHandler } = require("../middlewares/error.middleware");
const { getSubmissionAnalytics } = require("../services/admin.service");

const analyticsDashboard = asyncHandler(async (req, res) => {
  const analytics = await getSubmissionAnalytics();

  res.status(200).json({
    success: true,
    message: "Admin submission analytics",
    data: analytics,
  });
});

module.exports = { analyticsDashboard };