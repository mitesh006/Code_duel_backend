const { Queue } = require("bullmq");
const { config } = require("./env");
const logger = require("../utils/logger");

/**
 * Redis connection configuration for BullMQ
 */
const redisConnection = {
  host: config.redisHost,
  port: config.redisPort,
  password: config.redisPassword,
  db: config.redisDb,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  tls: config.redisHost.includes('upstash.io') ? {} : undefined, // Enable TLS for Upstash
};

/**
 * Evaluation Queue
 * Handles all evaluation-related jobs
 */
const evaluationQueue = new Queue("evaluation", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry failed jobs up to 3 times
    backoff: {
      type: "exponential",
      delay: 5000, // Start with 5 seconds, then 10s, 20s, etc.
    },
    removeOnComplete: {
      age: 86400, // Keep completed jobs for 24 hours
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 604800, // Keep failed jobs for 7 days
      count: 5000, // Keep max 5000 failed jobs
    },
  },
});

/**
 * Log queue events
 */
evaluationQueue.on("error", (error) => {
  logger.error("Evaluation queue error:", error);
});

evaluationQueue.on("waiting", (job) => {
  logger.debug(`Job ${job.id} is waiting`);
});

evaluationQueue.on("active", (job) => {
  logger.info(`Job ${job.id} is now active`);
});

evaluationQueue.on("completed", (job) => {
  logger.info(`Job ${job.id} completed successfully`);
});

evaluationQueue.on("failed", (job, error) => {
  logger.error(`Job ${job?.id} failed:`, error);
});

/**
 * Gracefully close the queue
 */
const closeQueue = async () => {
  logger.info("Closing evaluation queue...");
  await evaluationQueue.close();
  logger.info("Evaluation queue closed");
};

module.exports = {
  evaluationQueue,
  closeQueue,
  redisConnection,
};
