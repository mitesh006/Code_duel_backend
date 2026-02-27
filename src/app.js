const express = require("express");
const cors = require("cors");
const { config } = require("./config/env");
const { errorHandler, notFound } = require("./middlewares/error.middleware");
const logger = require("./utils/logger");

// Import routes
const authRoutes = require("./routes/auth.routes");
const challengeRoutes = require("./routes/challenge.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const leetcodeRoutes = require("./routes/leetcode.routes");
const { apiLimiter, authLimiter } = require('./middlewares/rateLimiter.middleware');

/**
 * Initialize Express application
 */
const createApp = () => {
  const app = express();

  // 1. CORS configuration (must come before rate limiters so preflight requests are handled)
  app.use(
    cors({
      // if corsOrigin is wildcard we avoid setting credentials since browsers reject wildcard with credentials
      origin: config.corsOrigin,
      ...(config.corsOrigin === '*' ? {} : { credentials: true }),
    })
  );

  // 2. Security Middlewares (Team T066 Implementation)
  // Apply global rate limiting to all API routes
  app.use('/api/', apiLimiter);
  
  // Apply strict limiting specifically to auth routes
  app.use('/api/auth/', authLimiter);

  // 3. Body parser middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req, res, next) => {
    // logger.info(`${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({
      success: true,
      message: "Server is healthy",
      timestamp: new Date().toISOString(),
    });
  });

  // API routes
  app.use("/api/auth", authRoutes);
  app.use("/api/challenges", challengeRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/leetcode", leetcodeRoutes);

  // Root endpoint
  app.get("/", (req, res) => {
    res.status(200).json({
      success: true,
      message: "LeetCode Daily Challenge Tracker API",
      version: "1.0.0",
      endpoints: {
        auth: "/api/auth",
        challenges: "/api/challenges",
        dashboard: "/api/dashboard",
        health: "/health",
      },
    });
  });

  // 404 handler
  app.use(notFound);

  // Global error handler
  app.use(errorHandler);

  return app;
};

module.exports = createApp;