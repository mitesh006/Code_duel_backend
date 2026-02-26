const cron = require("node-cron");
const { config } = require("./env");
const logger = require("../utils/logger");
const evaluationService = require("../services/evaluation.service");
const emailService = require("../services/email.service");

class CronManager {
  constructor() {
    this.jobs = [];
  }

  /**
   * Initialize all cron jobs
   */
  initializeCronJobs() {
    if (!config.cronEnabled) {
      logger.info("Cron jobs are disabled");
      return;
    }

    // Daily evaluation job - runs every day at configured time (default: 1 AM)
    const dailyEvaluationJob = cron.schedule(
      config.dailyEvaluationTime,
      async () => {
        logger.info("Starting daily evaluation cron job");
        try {
          await evaluationService.runDailyEvaluationWithQueue(); // UPDATED: Use queue-based evaluation
          logger.info("Daily evaluation jobs queued successfully");
        } catch (error) {
          logger.error("Daily evaluation queueing failed:", error);
        }
      },
      {
        scheduled: true,
        timezone: "UTC", // Use UTC or configure based on requirements
      }
    );

    this.jobs.push({
      name: "dailyEvaluation",
      job: dailyEvaluationJob,
    });

    // Daily reminder job - runs every day at configured time (default: 6 PM)
    if (config.emailEnabled) {
      const dailyReminderJob = cron.schedule(
        config.dailyReminderTime,
        async () => {
          logger.info("Starting daily reminder cron job");
          try {
            await emailService.sendDailyReminders();
            logger.info("Daily reminders sent successfully");
          } catch (error) {
            logger.error("Daily reminder job failed:", error);
          }
        },
        {
          scheduled: true,
          timezone: "UTC",
        }
      );

      this.jobs.push({
        name: "dailyReminder",
        job: dailyReminderJob,
      });

      // Weekly summary job - runs every Sunday at configured time (default: 10 AM)
      const weeklySummaryJob = cron.schedule(
        config.weeklySummaryTime,
        async () => {
          logger.info("Starting weekly summary cron job");
          try {
            await emailService.sendWeeklySummaries();
            logger.info("Weekly summaries sent successfully");
          } catch (error) {
            logger.error("Weekly summary job failed:", error);
          }
        },
        {
          scheduled: true,
          timezone: "UTC",
        }
      );

      this.jobs.push({
        name: "weeklySummary",
        job: weeklySummaryJob,
      });

      logger.info(
        `Email cron jobs initialized. Daily reminder: ${config.dailyReminderTime}, Weekly summary: ${config.weeklySummaryTime}`
      );
    }

    logger.info(
      `Cron jobs initialized. Daily evaluation scheduled at: ${config.dailyEvaluationTime}`
    );
  }

  /**
   * Stop all cron jobs
   */
  stopAllJobs() {
    this.jobs.forEach(({ name, job }) => {
      job.stop();
      logger.info(`Stopped cron job: ${name}`);
    });
  }

  /**
   * Manually trigger daily evaluation (for testing purposes)
   */
  async triggerDailyEvaluation() {
    logger.info("Manually triggering daily evaluation");
    try {
      await evaluationService.runDailyEvaluationWithQueue(); // UPDATED: Use queue-based evaluation
      logger.info("Manual daily evaluation jobs queued successfully");
    } catch (error) {
      logger.error("Manual daily evaluation queueing failed:", error);
      throw error;
    }
  }
}

module.exports = new CronManager();
