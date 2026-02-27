const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

const config = {
  // Server Configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  backendUrl:process.env.BACKEND_URL || "http://localhost:3000",


  // Database Configuration
  databaseUrl: process.env.DATABASE_URL,

  // JWT Configuration
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",

  // Encryption Configuration
  encryptionKey: process.env.ENCRYPTION_KEY,

  // LeetCode API Configuration
  leetcodeGraphqlUrl:
    process.env.LEETCODE_GRAPHQL_URL || "https://leetcode.com/graphql",
  leetcodeSubmissionFetchLimit: (() => {
    const parsed = parseInt(process.env.LEETCODE_SUBMISSION_FETCH_LIMIT, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }

    return 100;
  })(),

  // Cron Configuration
  cronEnabled: process.env.CRON_ENABLED === "true",
  dailyEvaluationTime: process.env.DAILY_EVALUATION_TIME || "0 1 * * *", // 1 AM daily
  dailyReminderTime: process.env.DAILY_REMINDER_TIME || "0 18 * * *", // 6 PM daily
  weeklySummaryTime: process.env.WEEKLY_SUMMARY_TIME || "0 10 * * 0", // Sunday 10 AM

  // Email Configuration
  smtpHost: process.env.SMTP_HOST,
  smtpPort: parseInt(process.env.SMTP_PORT) || 587,
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  emailFrom: process.env.EMAIL_FROM || "Code Duel <noreply@codeduel.com>",
  emailEnabled: process.env.EMAIL_ENABLED === "true",

  // CORS Configuration
  corsOrigin: process.env.CORS_ORIGIN || "*",
};

// Validate critical environment variables
const validateConfig = () => {
  const required = ["databaseUrl", "jwtSecret", "encryptionKey"];
  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};

module.exports = { config, validateConfig };
