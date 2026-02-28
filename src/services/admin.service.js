const { prisma } = require("../config/prisma");

const getSubmissionAnalytics = async () => {
  // Submissions per day
  const submissionsPerDay = await prisma.dailySubmission.groupBy({
    by: ["date"],
    _sum: { total: true },
    orderBy: { date: "asc" },
  });

  // Pass/fail rate per challenge
  const passFailRate = await prisma.dailySubmission.groupBy({
    by: ["challengeId"],
    _sum: { passed: true, failed: true, total: true },
  });

  // Challenges with highest fail rates
  const failRates = passFailRate
    .map((c) => ({
      challengeId: c.challengeId,
      failRate: c._sum.failed / c._sum.total,
      totalSubmissions: c._sum.total,
    }))
    .sort((a, b) => b.failRate - a.failRate)
    .slice(0, 5); // top 5 challenges

  return {
    submissionsPerDay,
    passFailRate,
    highestFailChallenges: failRates,
  };
};

module.exports = { getSubmissionAnalytics };