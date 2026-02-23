const { prisma } = require("../config/prisma");
const evaluationService = require("../services/evaluation.service");
const penaltyService = require("../services/penalty.service");
const statsService = require("../services/stats.service");
const { asyncHandler } = require("../middlewares/error.middleware");

/**
 * Get dashboard overview for current user
 * GET /api/dashboard
 */
const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get all active memberships
  const memberships = await prisma.challengeMember.findMany({
    where: {
      userId,
      isActive: true,
      challenge: {
        status: "ACTIVE",
      },
    },
    include: {
      challenge: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          minSubmissionsPerDay: true,
          penaltyAmount: true,
        },
      },
    },
  });

  if (memberships.length === 0) {
    return res.status(200).json({ success: true, data: [] });
  }

  const memberIds = memberships.map((m) => m.id);

  // Delegate all bulk fetching and grouping to the service layer.
  // getBulkMemberDailyResults uses a 7-calendar-day window (not take:7) so
  // that missing days are correctly represented as absent entries in the
  // activity strip rather than being silently skipped.
  const [todayResultByMember, recentResultsByMember] = await Promise.all([
    evaluationService.getBulkTodayResults(memberIds),
    evaluationService.getBulkMemberDailyResults(memberIds, 7),
  ]);

  const dashboardData = memberships.map((membership) => {
    const todayResult = todayResultByMember[membership.id] || null;
    const memberRecentResults = recentResultsByMember[membership.id] || [];

    return {
      challenge: membership.challenge,
      currentStreak: membership.currentStreak,
      longestStreak: membership.longestStreak,
      totalPenalties: membership.totalPenalties,
      todayStatus: todayResult
        ? {
            completed: todayResult.completed,
            submissionsCount: todayResult.submissionsCount,
            evaluatedAt: todayResult.evaluatedAt,
          }
        : null,
      recentResults: memberRecentResults.map((r) => ({
        date: r.date,
        completed: r.completed,
        submissionsCount: r.submissionsCount,
      })),
    };
  });

  res.status(200).json({
    success: true,
    data: dashboardData,
  });
});

/**
 * Get detailed challenge progress for a specific challenge
 * GET /api/dashboard/challenge/:challengeId
 */
const getChallengeProgress = asyncHandler(async (req, res) => {
  const { challengeId } = req.params;
  const userId = req.user.id;

  // Get membership
  const membership = await prisma.challengeMember.findUnique({
    where: {
      challengeId_userId: {
        challengeId,
        userId,
      },
    },
    include: {
      challenge: {
        select: {
          id: true,
          name: true,
          description: true,
          startDate: true,
          endDate: true,
          minSubmissionsPerDay: true,
          difficultyFilter: true,
          uniqueProblemConstraint: true,
          penaltyAmount: true,
          status: true,
        },
      },
    },
  });

  if (!membership) {
    return res.status(404).json({
      success: false,
      message: "Challenge membership not found",
    });
  }

  // Get all daily results
  const dailyResults = await evaluationService.getMemberDailyResults(
    membership.id,
    100
  );

  // Get penalty history
  const penalties = await penaltyService.getMemberPenalties(membership.id);

  // Calculate statistics
  const totalDays = dailyResults.length;
  const completedDays = dailyResults.filter((r) => r.completed).length;
  const failedDays = totalDays - completedDays;
  const completionRate = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;

  res.status(200).json({
    success: true,
    data: {
      challenge: membership.challenge,
      stats: {
        currentStreak: membership.currentStreak,
        longestStreak: membership.longestStreak,
        totalPenalties: membership.totalPenalties,
        totalDays,
        completedDays,
        failedDays,
        completionRate: completionRate.toFixed(2),
      },
      dailyResults,
      penalties,
    },
  });
});

/**
 * Get leaderboard for a challenge
 * GET /api/dashboard/challenge/:challengeId/leaderboard
 */
const getChallengeLeaderboard = asyncHandler(async (req, res) => {
  const { challengeId } = req.params;

  // Get all members with their stats
  const members = await prisma.challengeMember.findMany({
    where: {
      challengeId,
      isActive: true,
    },
    include: {
      user: {
        select: {
          username: true,
          leetcodeUsername: true,
        },
      },
    },
    orderBy: [
      { currentStreak: "desc" },
      { longestStreak: "desc" },
      { totalPenalties: "asc" },
    ],
  });

  if (members.length === 0) {
    return res.status(200).json({ success: true, data: [] });
  }

  const memberIds = members.map((m) => m.id);

  // Delegate bulk fetching to the service layer — one query for all members
  const statsByMember = await evaluationService.getBulkAllMemberResults(memberIds);

  const leaderboard = members.map((member) => {
    const { totalDays = 0, completedDays = 0 } = statsByMember[member.id] || {};
    const completionRate = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;

    return {
      username: member.user.username,
      leetcodeUsername: member.user.leetcodeUsername,
      currentStreak: member.currentStreak,
      longestStreak: member.longestStreak,
      totalPenalties: member.totalPenalties,
      completedDays,
      totalDays,
      completionRate: completionRate.toFixed(2),
    };
  });

  res.status(200).json({
    success: true,
    data: leaderboard,
  });
});

/**
 * Get today's status across all challenges
 * GET /api/dashboard/today
 */
const getTodayStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get all active memberships
  const memberships = await prisma.challengeMember.findMany({
    where: {
      userId,
      isActive: true,
      challenge: {
        status: "ACTIVE",
      },
    },
    include: {
      challenge: {
        select: {
          id: true,
          name: true,
          minSubmissionsPerDay: true,
        },
      },
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (memberships.length === 0) {
    return res.status(200).json({
      success: true,
      data: { date: today, challenges: [] },
    });
  }

  const memberIds = memberships.map((m) => m.id);

  // Delegate bulk fetching and grouping to the service layer
  const resultByMemberId = await evaluationService.getBulkTodayResults(memberIds);

  const todayStatuses = memberships.map((membership) => {
    const result = resultByMemberId[membership.id] || null;
    return {
      challengeId: membership.challenge.id,
      challengeName: membership.challenge.name,
      requiredSubmissions: membership.challenge.minSubmissionsPerDay,
      status: result
        ? {
            completed: result.completed,
            submissionsCount: result.submissionsCount,
            problemsSolved: result.problemsSolved,
            evaluatedAt: result.evaluatedAt,
          }
        : null,
    };
  });

  res.status(200).json({
    success: true,
    data: {
      date: today,
      challenges: todayStatuses,
    },
  });
});

/**
 * Get user's activity heatmap data
 * GET /api/dashboard/activity-heatmap
 */
const getActivityHeatmap = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const activityData = await statsService.getUserActivityHeatmap(userId);

  res.status(200).json({
    success: true,
    data: activityData,
  });
});

/**
 * Get user's comprehensive stats
 * GET /api/dashboard/stats
 */
const getStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const stats = await statsService.getUserStats(userId);

  res.status(200).json({
    success: true,
    data: stats,
  });
});

/**
 * Get user's submission chart data
 * GET /api/dashboard/submission-chart
 */
const getSubmissionChart = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const chartData = await statsService.getUserSubmissionChart(userId);

  res.status(200).json({
    success: true,
    data: chartData,
  });
});

module.exports = {
  getDashboard,
  getChallengeProgress,
  getChallengeLeaderboard,
  getTodayStatus,
  getActivityHeatmap,
  getStats,
  getSubmissionChart,
};
