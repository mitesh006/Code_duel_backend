const axios = require("axios");
const { config } = require("../config/env");
const { prisma } = require("../config/prisma");
const logger = require("../utils/logger");

// LeetCode GraphQL API endpoint
const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql/";

/**
 * GraphQL Query: Fetch recent AC submissions for a user
 * Inspired by: https://github.com/akarsh1995/leetcode-graphql-queries
 *
 * Returns: Recent accepted submissions with basic info
 * Note: Does NOT include difficulty in response
 */
const RECENT_SUBMISSIONS_QUERY = `
  query recentAcSubmissions($username: String!, $limit: Int!) {
    recentAcSubmissionList(username: $username, limit: $limit) {
      id
      title
      titleSlug
      timestamp
      statusDisplay
      lang
    }
  }
`;

/**
 * GraphQL Query: Fetch problem details including difficulty
 * Inspired by: https://github.com/akarsh1995/leetcode-graphql-queries
 *
 * Returns: Complete problem metadata including difficulty
 */
const PROBLEM_DETAILS_QUERY = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionId
      questionFrontendId
      title
      titleSlug
      difficulty
      likes
      dislikes
      isPaidOnly
      acRate
      topicTags {
        name
        slug
      }
    }
  }
`;

/**
 * GraphQL Query: Fetch user's submission calendar
 * Useful for getting submission counts by date
 */
const USER_CALENDAR_QUERY = `
  query userProfileCalendar($username: String!, $year: Int!) {
    matchedUser(username: $username) {
      userCalendar(year: $year) {
        activeYears
        streak
        totalActiveDays
        submissionCalendar
      }
    }
  }
`;

/**
 * GraphQL Query: Fetch detailed submissions with status
 * This query can be used for more granular submission data
 */
const USER_SUBMISSIONS_QUERY = `
  query userSubmissions($username: String!, $offset: Int!, $limit: Int!) {
    recentSubmissionList(username: $username, offset: $offset, limit: $limit) {
      title
      titleSlug
      timestamp
      statusDisplay
      lang
      runtime
      memory
    }
  }
`;

/**
 * Fetch LeetCode submissions for a user
 * @param {string} leetcodeUsername - LeetCode username
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @returns {Array} Array of submissions
 */
const fetchUserSubmissions = async (leetcodeUsername) => {
  try {
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0",
    };

    const submissionLimit = config.leetcodeSubmissionFetchLimit || 100;

    // Fetch recent submissions
    const response = await axios.post(
      config.leetcodeGraphqlUrl,
      {
        query: RECENT_SUBMISSIONS_QUERY,
        variables: {
          username: leetcodeUsername,
          limit: submissionLimit,
        },
      },
      { headers, timeout: 10000 }
    );

    if (!response.data || !response.data.data) {
      logger.warn(`No data returned for user: ${leetcodeUsername}`);
      return [];
    }

    const submissions = response.data.data.recentAcSubmissionList || [];

    logger.debug(
      `Fetched ${submissions.length} submissions for ${leetcodeUsername}`
    );

    return submissions;
  } catch (error) {
    // Handle rate limiting or network errors gracefully
    if (error.response && error.response.status === 429) {
      logger.error("LeetCode API rate limit exceeded");
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    logger.error("Error fetching LeetCode submissions:", error.message);
    throw new Error("Failed to fetch LeetCode submissions");
  }
};

/**
 * Parse submissions to extract difficulty and other metadata
 * Note: LeetCode API doesn't directly provide difficulty in submission data
 * This is a placeholder - in production, you might need to:
 * 1. Maintain a local cache of problem metadata
 * 2. Make additional API calls to fetch problem details
 * 3. Use web scraping (not recommended)
 *
 * @param {Array} submissions - Raw submissions from LeetCode
 * @returns {Array} Parsed submissions with metadata
 */
const parseSubmissions = async (submissions) => {
  // For now, we'll return submissions as-is
  // In production, you would enrich this data with problem difficulty
  return submissions.map((sub) => ({
    id: sub.id,
    title: sub.title,
    titleSlug: sub.titleSlug,
    timestamp: new Date(parseInt(sub.timestamp) * 1000),
    status: sub.statusDisplay,
    language: sub.lang,
    // Difficulty would be fetched from a separate source
    difficulty: null, // TODO: Implement difficulty fetching
  }));
};

/**
/**
 * Fetch submissions for a specific date (helper function)
 * @param {string} leetcodeUsername - LeetCode username
 * @param {Date} date - Date to fetch submissions for
 * @returns {Array} Submissions for the date
 */
const fetchSubmissionsForDate = async (leetcodeUsername, date) => {

  return await fetchUserSubmissions(leetcodeUsername);
};

/**
 * Core function to make GraphQL requests to LeetCode
 * @param {string} query - GraphQL query string
 * @param {Object} variables - Query variables
 * @returns {Promise<Object>} GraphQL response data
 */
const fetchLeetCodeData = async (query, variables) => {
  try {
    // Prepare headers
    const headers = {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://leetcode.com/",
      Origin: "https://leetcode.com",
    };

    // Make GraphQL request
    const response = await axios.post(
      config.leetcodeGraphqlUrl || "https://leetcode.com/graphql/",
      { query, variables },
      { headers, timeout: 15000 }
    );

    // Check for GraphQL errors
    if (response.data.errors) {
      logger.error("GraphQL errors:", response.data.errors);
      throw new Error(`GraphQL Error: ${response.data.errors[0].message}`);
    }

    if (!response.data || !response.data.data) {
      logger.warn("No data returned from LeetCode GraphQL");
      return null;
    }

    return response.data.data;
  } catch (error) {
    // Enhanced error handling
    if (error.response) {
      const status = error.response.status;
      if (status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }else if (status === 404) {
        throw new Error("Resource not found.");
      }
    }

    if (error.code === "ECONNABORTED") {
      throw new Error("Request timeout.");
    }

    logger.error("Error fetching LeetCode data:", error.message);
    throw error;
  }
};

/**
 * Fetch problem metadata (including difficulty) from cache or LeetCode API
 * Uses local cache to minimize API calls
 *
 * @param {string} titleSlug - Problem title slug (e.g., "two-sum")
 * @returns {Promise<Object>} Problem metadata including difficulty
 */
const fetchProblemMetadata = async (titleSlug) => {
  try {
    // Check cache first (if data is less than 7 days old)
    const cachedProblem = await prisma.problemMetadata.findUnique({
      where: { titleSlug },
    });

    const cacheExpiryDays = 7;
    const now = new Date();

    if (cachedProblem) {
      const daysSinceUpdate =
        (now - cachedProblem.lastFetchedAt) / (1000 * 60 * 60 * 24);

      if (daysSinceUpdate < cacheExpiryDays) {
        logger.debug(`Using cached metadata for problem: ${titleSlug}`);
        return cachedProblem;
      }
    }

    // Fetch from LeetCode API
    logger.debug(`Fetching fresh metadata for problem: ${titleSlug}`);

    const data = await fetchLeetCodeData(
      PROBLEM_DETAILS_QUERY,
      { titleSlug }
    );

    if (!data || !data.question) {
      logger.warn(`No problem data found for: ${titleSlug}`);
      return cachedProblem || null;
    }

    const problem = data.question;

    // Extract topic tags
    const topicTags = problem.topicTags
      ? problem.topicTags.map((tag) => tag.name)
      : [];

    // Prepare metadata object
    const metadata = {
      titleSlug: problem.titleSlug,
      questionId: problem.questionId,
      title: problem.title,
      difficulty: problem.difficulty,
      acRate: problem.acRate ? parseFloat(problem.acRate) : null,
      likes: problem.likes || 0,
      dislikes: problem.dislikes || 0,
      isPaidOnly: problem.isPaidOnly || false,
      topicTags,
      lastFetchedAt: now,
    };

    // Upsert to cache
    const savedMetadata = await prisma.problemMetadata.upsert({
      where: { titleSlug },
      update: { ...metadata, updatedAt: now },
      create: metadata,
    });

    logger.info(
      `Cached metadata for problem: ${titleSlug} (${problem.difficulty})`
    );

    return savedMetadata;
  } catch (error) {
    logger.error(`Failed to fetch metadata for ${titleSlug}:`, error.message);
    return cachedProblem || null;
  }
};

/**
 * Enrich submissions with problem metadata (difficulty, etc.)
 *
 * @param {Array} submissions - Raw submissions from LeetCode
 * @returns {Promise<Array>} Enriched submissions with difficulty
 */
const enrichSubmissionsWithMetadata = async (submissions) => {
  const enrichedSubmissions = [];

  for (const submission of submissions) {
    try {
      const metadata = await fetchProblemMetadata(
        submission.titleSlug
      );

      enrichedSubmissions.push({
        id: submission.id,
        title: submission.title,
        titleSlug: submission.titleSlug,
        timestamp: new Date(parseInt(submission.timestamp) * 1000),
        status: submission.statusDisplay,
        language: submission.lang,
        difficulty: metadata ? metadata.difficulty : "Unknown",
        questionId: metadata ? metadata.questionId : null,
        isPaidOnly: metadata ? metadata.isPaidOnly : false,
        topicTags: metadata ? metadata.topicTags : [],
      });
    } catch (error) {
      logger.warn(
        `Failed to enrich submission ${submission.titleSlug}:`,
        error.message
      );
      enrichedSubmissions.push({
        id: submission.id,
        title: submission.title,
        titleSlug: submission.titleSlug,
        timestamp: new Date(parseInt(submission.timestamp) * 1000),
        status: submission.statusDisplay,
        language: submission.lang,
        difficulty: "Unknown",
      });
    }
  }

  return enrichedSubmissions;
};

/**
/**
 * Fetch user profile statistics from LeetCode
 *
 * @param {string} username - LeetCode username
 * @returns {Promise<Object>} User statistics
 */
const fetchUserProfile = async (username) => {
  try {
    const currentYear = new Date().getFullYear();
    const data = await fetchLeetCodeData(
      USER_CALENDAR_QUERY,
      { username, year: currentYear }
    );

    if (!data || !data.matchedUser) {
      throw new Error("User not found");
    }

    const calendar = data.matchedUser.userCalendar;

    return {
      username,
      streak: calendar.streak || 0,
      totalActiveDays: calendar.totalActiveDays || 0,
      activeYears: calendar.activeYears || [],
      submissionCalendar: calendar.submissionCalendar
        ? JSON.parse(calendar.submissionCalendar)
        : {},
    };
  } catch (error) {
    logger.error(`Failed to fetch profile for ${username}:`, error.message);
    throw error;
  }
};

module.exports = {
  // Core functions
  fetchLeetCodeData,
  fetchUserSubmissions,
  fetchSubmissionsForDate,
  fetchProblemMetadata,
  enrichSubmissionsWithMetadata,
  parseSubmissions,

  // Additional features
  fetchUserProfile,

  // GraphQL queries (exported for reference/testing)
  RECENT_SUBMISSIONS_QUERY,
  PROBLEM_DETAILS_QUERY,
  USER_CALENDAR_QUERY,
  USER_SUBMISSIONS_QUERY,
};
