const { prisma } = require("../config/prisma");
const leetcodeService = require("./leetcode.service");
const penaltyService = require("./penalty.service");
const logger = require("../utils/logger");
const { sendStreakBrokenNotification } = require("./email.service");

/**
 * Run daily evaluation for all active challenges
 * This is the main function called by the cron job
 */
const runDailyEvaluation = async () => {
  const evaluationDate = new Date();
  evaluationDate.setHours(0, 0, 0, 0); // Start of day

  logger.info(
    `Starting daily evaluation for date: ${evaluationDate.toISOString()}`
  );

  try {
    // Get all active challenges
    const activeChallenges = await prisma.challenge.findMany({
      where: {
        status: "ACTIVE",
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
      include: {
        members: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true,
                leetcodeUsername: true,
              },
            },
          },
        },
      },
    });

    logger.info(
      `Found ${activeChallenges.length} active challenges to evaluate`
    );

    // Evaluate each challenge
    for (const challenge of activeChallenges) {
      try {
        await evaluateChallenge(challenge, evaluationDate);
      } catch (error) {
        logger.error(`Failed to evaluate challenge ${challenge.id}:`, error);
        // Continue with other challenges even if one fails
      }
    }

    logger.info("Daily evaluation completed successfully");
  } catch (error) {
    logger.error("Daily evaluation failed:", error);
    throw error;
  }
};

/**
 * Evaluate a single challenge for a specific date
 * @param {Object} challenge - Challenge object with members
 * @param {Date} evaluationDate - Date to evaluate
 */
const evaluateChallenge = async (challenge, evaluationDate) => {
  logger.info(`Evaluating challenge: ${challenge.name} (${challenge.id})`);

  for (const member of challenge.members) {
    try {
      await evaluateMember(challenge, member, evaluationDate);
    } catch (error) {
      logger.error(
        `Failed to evaluate member ${member.user.username} for challenge ${challenge.name}:`,
        error
      );
      // Continue with other members
    }
  }
};

/**
 * Evaluate a single member for a specific date
 * @param {Object} challenge - Challenge object
 * @param {Object} member - Challenge member object
 * @param {Date} evaluationDate - Date to evaluate
 */
const evaluateMember = async (challenge, member, evaluationDate) => {
  const user = member.user;

  // Check if user has LeetCode username
  if (!user.leetcodeUsername) {
    logger.warn(`User ${user.username} doesn't have a LeetCode username set`);

    // Create a failed result
    await createDailyResult(
      challenge.id,
      member.id,
      evaluationDate,
      false,
      0,
      [],
      {
        reason: "No LeetCode username configured",
      }
    );

    // Apply penalty
    await applyPenaltyForFailure(
      challenge,
      member,
      evaluationDate,
      "No LeetCode username configured"
    );
    return;
  }


    );
    submissions = submissions?.recentAcSubmissionList || [];
  } catch (error) {
    logger.error(
      `Failed to fetch submissions for ${user.leetcodeUsername}:`,
      error
    );

    // Mark as pending, do not penalize for API errors
    await createDailyResult(
      challenge.id,
      member.id,
      evaluationDate,
      null, // null = pending
      0,
      [],
      {
        reason: "LeetCode API unavailable or rate limited",
        error: error.message,
      }
    );
    return;
  }

  // Enrich submissions with metadata (difficulty, etc.)
  const enrichedSubmissions =
    await leetcodeService.enrichSubmissionsWithMetadata(
      submissions
    );

  // Filter by difficulty if specified
  let filteredSubmissions = enrichedSubmissions;
  if (challenge.difficultyFilter && challenge.difficultyFilter.length > 0) {
    filteredSubmissions = enrichedSubmissions.filter((sub) =>
      challenge.difficultyFilter.includes(sub.difficulty)
    );

    logger.debug(
      `Filtered ${enrichedSubmissions.length} submissions to ${
        filteredSubmissions.length
      } matching difficulties: ${challenge.difficultyFilter.join(", ")}`
    );
  }

  // Extract unique problems if constraint is enabled
  const problemsSolved = challenge.uniqueProblemConstraint
    ? [...new Set(filteredSubmissions.map((s) => s.titleSlug))]
    : filteredSubmissions.map((s) => s.titleSlug);

  const submissionsCount = problemsSolved.length;

  // Check if member met the requirement
  const completed = submissionsCount >= challenge.minSubmissionsPerDay;

  // Create daily result
  await createDailyResult(
    challenge.id,
    member.id,
    evaluationDate,
    completed,
    submissionsCount,
    problemsSolved,
    {
      submissions: filteredSubmissions.map((s) => ({
        title: s.title,
        titleSlug: s.titleSlug,
        difficulty: s.difficulty,
        timestamp: s.timestamp,
        language: s.language,
      })),
    }
  );

  // Update streak
  await updateStreak(member.id, completed, user, challenge.name);

  // Apply penalty if failed
  if (!completed) {
    await applyPenaltyForFailure(
      challenge,
      member,
      evaluationDate,
      `Failed to meet daily requirement: ${submissionsCount}/${challenge.minSubmissionsPerDay} submissions`
    );
  }

  logger.info(
    `Member ${user.username} evaluation: ${
      completed ? "PASSED" : "FAILED"
    } (${submissionsCount}/${challenge.minSubmissionsPerDay})`
  );
};

/**
 * Create a daily result record
 */
const createDailyResult = async (
  challengeId,
  memberId,
  date,
  completed,
  submissionsCount,
  problemsSolved,
  metadata = {}
) => {
  return await prisma.dailyResult.create({
    data: {
      challengeId,
      memberId,
      date,
      completed,
      submissionsCount,
      problemsSolved,
      evaluatedAt: new Date(),
      metadata,
    },
  });
};

/**
 * Update member's streak based on completion status
 */
const updateStreak = async (memberId, completed, user, challengeName) => {
  const member = await prisma.challengeMember.findUnique({
    where: { id: memberId },
  });

  if (completed) {
    // Increment current streak
    const newStreak = member.currentStreak + 1;
    const newLongest = Math.max(newStreak, member.longestStreak);

    await prisma.challengeMember.update({
      where: { id: memberId },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongest,
      },
    });
  } else {
    // Send streak broken notification if they had a streak
    if (member.currentStreak > 0 && user && user.email) {
      sendStreakBrokenNotification(
        user.email,
        user.username,
        member.currentStreak,
        challengeName
      ).catch((err) => {
        logger.error(`Failed to send streak broken notification: ${err.message}`);
      });
    }

    // Reset current streak
    await prisma.challengeMember.update({
      where: { id: memberId },
      data: {
        currentStreak: 0,
      },
    });
  }
};

/**
 * Apply penalty for failing daily requirement
 */
const applyPenaltyForFailure = async (challenge, member, date, reason) => {
  if (challenge.penaltyAmount > 0) {
    await penaltyService.applyPenalty(
      member.id,
      challenge.penaltyAmount,
      reason,
      date
    );
  }
};

/**
 * Get daily results for a member
 * @param {string} memberId - Challenge member ID
 * @param {number} limit - Number of results to fetch
 * @returns {Array} Daily results
 */
const getMemberDailyResults = async (memberId, limit = 30) => {
  return await prisma.dailyResult.findMany({
    where: { memberId },
    orderBy: { date: "desc" },
    take: limit,
  });
};

/**
 * Normalise a Date to local midnight so all date comparisons are consistent.
 * Uses local time to match the convention used throughout the codebase
 * (stats.service.js, dashboard.controller.js, cron evaluation).
 * @param {Date} [date=new Date()] - Date to normalise (defaults to now)
 * @returns {Date} Normalised date at 00:00:00.000 local time
 */
const normaliseToMidnight = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Get daily results for multiple members in a single bulk query.
 * Results are returned grouped by memberId to avoid N+1 query patterns.
 *
 * The window is intentionally calendar-based (e.g. daysBack=7 means the last
 * 7 calendar days including today). This is the correct semantic for dashboard
 * activity strips where missing days are meaningful — they represent days on
 * which the member did not submit. Using a record-count limit (take: N) would
 * silently skip missed days and surface stale results from weeks ago.
 *
 * @param {string[]} memberIds - Array of challenge member IDs
 * @param {number} daysBack - Number of calendar days to look back (default 7)
 * @returns {Object} Map of memberId -> dailyResult[], ordered newest-first
 */
const getBulkMemberDailyResults = async (memberIds, daysBack = 7) => {
  if (!memberIds || memberIds.length === 0) return {};

  const since = normaliseToMidnight();
  since.setDate(since.getDate() - (daysBack - 1));

  const results = await prisma.dailyResult.findMany({
    where: {
      memberId: { in: memberIds },
      date: { gte: since },
    },
    orderBy: { date: "desc" },
  });

  return results.reduce((acc, result) => {
    if (!acc[result.memberId]) acc[result.memberId] = [];
    acc[result.memberId].push(result);
    return acc;
  }, {});
};

/**
 * Get all daily results for multiple members in a single bulk query.
 * Returns aggregated stats (totalDays, completedDays) grouped by memberId,
 * used by the leaderboard which needs full-history counts rather than a
 * calendar window.
 * @param {string[]} memberIds - Array of challenge member IDs
 * @returns {Object} Map of memberId -> { totalDays, completedDays }
 */
const getBulkAllMemberResults = async (memberIds) => {
  if (!memberIds || memberIds.length === 0) return {};

  const results = await prisma.dailyResult.findMany({
    where: { memberId: { in: memberIds } },
    select: { memberId: true, completed: true },
  });

  return results.reduce((acc, result) => {
    if (!acc[result.memberId]) acc[result.memberId] = { totalDays: 0, completedDays: 0 };
    acc[result.memberId].totalDays += 1;
    if (result.completed) acc[result.memberId].completedDays += 1;
    return acc;
  }, {});
};

/**
 * Get today's daily result for multiple members in a single bulk query.
 * Results are returned as a map keyed by memberId for O(1) lookup.
 * @param {string[]} memberIds - Array of challenge member IDs
 * @returns {Object} Map of memberId -> dailyResult (or undefined if none)
 */
const getBulkTodayResults = async (memberIds) => {
  if (!memberIds || memberIds.length === 0) return {};

  const today = normaliseToMidnight();

  const results = await prisma.dailyResult.findMany({
    where: {
      memberId: { in: memberIds },
      date: today,
    },
  });

  return results.reduce((acc, result) => {
    acc[result.memberId] = result;
    return acc;
  }, {});
};

/**
 * Get today's status for a member
 * @param {string} memberId - Challenge member ID
 * @returns {Object|null} Today's daily result or null
 */
const getTodayStatus = async (memberId) => {
  const today = normaliseToMidnight();

  return await prisma.dailyResult.findUnique({
    where: {
      challengeId_memberId_date: {
        challengeId: (
          await prisma.challengeMember.findUnique({ where: { id: memberId } })
        ).challengeId,
        memberId,
        date: today,
      },
    },
  });
};

module.exports = {
  runDailyEvaluation,
  evaluateChallenge,
  evaluateMember,
  getMemberDailyResults,
  getBulkMemberDailyResults,
  getBulkAllMemberResults,
  getBulkTodayResults,
  getTodayStatus,
};
