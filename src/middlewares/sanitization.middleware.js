/**
 * Sanitization Middleware
 * Provides middleware functions for automatic input sanitization and security scanning
 */

const {
  sanitizeString,
  sanitizeJson,
  securityScan,
} = require("../utils/sanitizer");
const logger = require("../utils/logger");

/**
 * Middleware to sanitize all string inputs in request body, query, and params
 * @param {Object} options - Configuration options
 */
const sanitizeInputs = (options = {}) => {
  return (req, res, next) => {
    try {
      // Sanitize request body
      if (req.body && typeof req.body === "object") {
        req.body = sanitizeJson(req.body, {
          maxLength: options.maxLength || 1000,
        });
      }

      // Sanitize query parameters
      if (req.query && typeof req.query === "object") {
        for (const key in req.query) {
          if (typeof req.query[key] === "string") {
            req.query[key] = sanitizeString(req.query[key], {
              maxLength: 500,
            });
          }
        }
      }

      // Sanitize URL parameters
      if (req.params && typeof req.params === "object") {
        for (const key in req.params) {
          if (typeof req.params[key] === "string") {
            req.params[key] = sanitizeString(req.params[key], {
              maxLength: 200,
            });
          }
        }
      }

      next();
    } catch (error) {
      logger.error(`Sanitization error: ${error.message}`);
      return res.status(400).json({
        success: false,
        message: "Invalid input detected",
        error: error.message,
      });
    }
  };
};

/**
 * Middleware to perform security scanning on inputs
 * Blocks requests with detected threats
 */
const securityScanMiddleware = (req, res, next) => {
  const scanInputs = (obj, path = "") => {
    if (!obj) return { safe: true, threats: [] };

    if (typeof obj === "string") {
      const scan = securityScan(obj);
      if (!scan.safe) {
        return {
          safe: false,
          threats: scan.threats,
          path: path || "input",
        };
      }
    } else if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const result = scanInputs(obj[i], `${path}[${i}]`);
        if (!result.safe) return result;
      }
    } else if (typeof obj === "object") {
      for (const key in obj) {
        const result = scanInputs(obj[key], path ? `${path}.${key}` : key);
        if (!result.safe) return result;
      }
    }

    return { safe: true, threats: [] };
  };

  try {
    // Scan body
    const bodyResult = scanInputs(req.body, "body");
    if (!bodyResult.safe) {
      logger.warn(
        `Security threat detected in ${bodyResult.path}: ${bodyResult.threats.join(", ")}`
      );
      return res.status(400).json({
        success: false,
        message: "Security threat detected in input",
        threats: bodyResult.threats,
      });
    }

    // Scan query
    const queryResult = scanInputs(req.query, "query");
    if (!queryResult.safe) {
      logger.warn(
        `Security threat detected in ${queryResult.path}: ${queryResult.threats.join(", ")}`
      );
      return res.status(400).json({
        success: false,
        message: "Security threat detected in input",
        threats: queryResult.threats,
      });
    }

    // Scan params
    const paramsResult = scanInputs(req.params, "params");
    if (!paramsResult.safe) {
      logger.warn(
        `Security threat detected in ${paramsResult.path}: ${paramsResult.threats.join(", ")}`
      );
      return res.status(400).json({
        success: false,
        message: "Security threat detected in input",
        threats: paramsResult.threats,
      });
    }

    next();
  } catch (error) {
    logger.error(`Security scan error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Security scanning failed",
    });
  }
};

/**
 * Middleware to enforce content length limits
 * @param {number} maxSize - Maximum content length in bytes
 */
const enforceSizeLimit = (maxSize = 100000) => {
  return (req, res, next) => {
    const contentLength = req.headers["content-length"];

    if (contentLength && parseInt(contentLength) > maxSize) {
      logger.warn(
        `Request rejected: content length ${contentLength} exceeds limit ${maxSize}`
      );
      return res.status(413).json({
        success: false,
        message: "Request payload too large",
      });
    }

    next();
  };
};

/**
 * Middleware to sanitize and validate specific fields in request body
 * @param {Object} fieldRules - Rules for each field
 */
const sanitizeFields = (fieldRules) => {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== "object") {
      return next();
    }

    try {
      const { sanitizeObject } = require("../utils/sanitizer");
      req.body = sanitizeObject(req.body, fieldRules);
      next();
    } catch (error) {
      logger.error(`Field sanitization error: ${error.message}`);
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };
};

module.exports = {
  sanitizeInputs,
  securityScanMiddleware,
  enforceSizeLimit,
  sanitizeFields,
};
