const { Worker } = require("bullmq");
const { redisConnection } = require("../config/queue");
const { prisma } = require("../config/prisma");
const leetcodeService = require("../services/leetcode.service");
const penaltyService = require("../services/penalty.service");
const { sendStreakBrokenNotification } = require("../services/email.service");
const logger = require("../utils/logger");

/**
 * Process member evaluation job
 * This evaluates a single member for a specific date
 */
const processMemberEvaluation = async (job) => {
  const { challenge, member, evaluationDate } = job.data;
  const user = member.user;

  logger.info(
    `Processing evaluation for member: ${user.username} in challenge: ${challenge.name}`
  );

  try {
    // Check if user has LeetCode username
    if (!user.leetcodeUsername) {
      logger.warn(`User ${user.username} doesn't have a LeetCode username set`);

      // Create a failed result
      await createDailyResult(
        challenge.id,
        member.id,
        new Date(evaluationDate),
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
        new Date(evaluationDate),
        "No LeetCode username configured"
      );
      return { success: true, status: "failed", reason: "No LeetCode username" };
    }

    // Fetch submissions for the date
    let submissions;
    try {
      submissions = await leetcodeService.fetchSubmissionsForDate(
        user.leetcodeUsername,
        new Date(evaluationDate)
      );
    } catch (error) {
      logger.error(
        `Failed to fetch submissions for ${user.leetcodeUsername}:`,
        error
      );

      // Create a failed result due to API error
      await createDailyResult(
        challenge.id,
        member.id,
        new Date(evaluationDate),
        false,
        0,
        [],
        {
          reason: "Failed to fetch submissions from LeetCode",
          error: error.message,
        }
      );

      // Don't apply penalty for API errors, but throw to retry
      throw error;
    }

    // Enrich submissions with metadata (difficulty, etc.)
    const enrichedSubmissions =
      await leetcodeService.enrichSubmissionsWithMetadata(submissions);

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
      new Date(evaluationDate),
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
        new Date(evaluationDate),
        `Failed to meet daily requirement: ${submissionsCount}/${challenge.minSubmissionsPerDay} submissions`
      );
    }

    logger.info(
      `Member ${user.username} evaluation: ${
        completed ? "PASSED" : "FAILED"
      } (${submissionsCount}/${challenge.minSubmissionsPerDay})`
    );

    return {
      success: true,
      status: completed ? "passed" : "failed",
      submissionsCount,
      required: challenge.minSubmissionsPerDay,
    };
  } catch (error) {
    logger.error(
      `Error processing member evaluation for ${user.username}:`,
      error
    );
    throw error; // Let BullMQ handle the retry
  }
};

/**
 * Process challenge evaluation job
 * This creates member evaluation jobs for all members in a challenge
 */
const processChallengeEvaluation = async (job) => {
  const { challengeId, evaluationDate } = job.data;

  logger.info(
    `Processing challenge evaluation for challenge: ${challengeId} on ${evaluationDate}`
  );

  try {
    // Get challenge with members
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
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

    if (!challenge) {
      throw new Error(`Challenge ${challengeId} not found`);
    }

    logger.info(
      `Challenge ${challenge.name} has ${challenge.members.length} active members`
    );

    // Add member evaluation jobs to the queue
    const { evaluationQueue } = require("../config/queue");
    
    const memberJobs = challenge.members.map((member) => ({
      name: "member-evaluation",
      data: {
        challenge,
        member,
        evaluationDate,
      },
      opts: {
        jobId: `member-${member.id}-${evaluationDate}`, // Prevent duplicate jobs
      },
    }));

    await evaluationQueue.addBulk(memberJobs);

    logger.info(
      `Added ${memberJobs.length} member evaluation jobs for challenge ${challenge.name}`
    );

    return {
      success: true,
      challengeName: challenge.name,
      membersQueued: memberJobs.length,
    };
  } catch (error) {
    logger.error(`Error processing challenge evaluation:`, error);
    throw error;
  }
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
 * Create and start the evaluation worker
 */
const createEvaluationWorker = () => {
  const worker = new Worker(
    "evaluation",
    async (job) => {
      logger.info(`Processing job ${job.id} of type: ${job.name}`);

      switch (job.name) {
        case "challenge-evaluation":
          return await processChallengeEvaluation(job);
        case "member-evaluation":
          return await processMemberEvaluation(job);
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
    },
    {
      connection: redisConnection,
      concurrency: 10, // Process up to 10 jobs simultaneously
      limiter: {
        max: 20, // Max 20 jobs
        duration: 1000, // Per second (rate limiting to prevent API abuse)
      },
    }
  );

  // Worker event listeners
  worker.on("completed", (job, result) => {
    logger.info(`Job ${job.id} completed:`, result);
  });

  worker.on("failed", (job, error) => {
    logger.error(`Job ${job?.id} failed:`, error);
  });

  worker.on("error", (error) => {
    logger.error("Worker error:", error);
  });

  logger.info("Evaluation worker started with concurrency: 10");

  return worker;
};

module.exports = {
  createEvaluationWorker,
};
