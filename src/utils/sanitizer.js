/**
 * Input Sanitization Utility
 * Centralizes all input sanitization and validation logic to protect against:
 * - XSS (Cross-Site Scripting)
 * - HTML/Script injection
 * - Path traversal attacks
 * - Malicious protocol injection
 * - Control character injection
 * - DoS via extremely long inputs
 * - JSON payload injection
 */

const logger = require("./logger");

// Configuration constants
const CONFIG = {
  MAX_STRING_LENGTH: 10000, // 10KB for general strings
  MAX_TEXT_LENGTH: 50000, // 50KB for long text content
  MAX_URL_LENGTH: 2048,
  MAX_EMAIL_LENGTH: 254,
  MAX_USERNAME_LENGTH: 50,
  MAX_PASSWORD_LENGTH: 128,
  MAX_FILENAME_LENGTH: 255,
  MAX_JSON_LENGTH: 100000, // 100KB for JSON payloads
};

// Dangerous patterns to detect and block
const DANGEROUS_PATTERNS = {
  // XSS and script injection
  SCRIPT_TAGS: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  HTML_TAGS: /<[^>]*>/g,
  EVENT_HANDLERS: /on\w+\s*=\s*["'][^"']*["']/gi,
  
  // Protocol injection
  JAVASCRIPT_PROTOCOL: /^\s*javascript:/i,
  DATA_PROTOCOL: /^\s*data:/i,
  VBSCRIPT_PROTOCOL: /^\s*vbscript:/i,
  FILE_PROTOCOL: /^\s*file:/i,
  
  // Path traversal
  PATH_TRAVERSAL: /(\.\.[\/\\]|\.\.%2[fF]|\.\.%5[cC])/,
  
  // Control characters (except common whitespace)
  CONTROL_CHARS: /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g,
  
  // SQL injection patterns (basic detection)
  SQL_INJECTION: /(union\s+select|insert\s+into|delete\s+from|drop\s+table|update\s+set|or\s+1\s*=\s*1|;\s*--)/i,
  
  // Null byte injection
  NULL_BYTE: /\x00/g,
};

// Safe protocols for URLs
const SAFE_PROTOCOLS = ["http:", "https:", "mailto:", "tel:"];

/**
 * Sanitize a general string input
 * @param {string} input - The input string to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized string
 */
function sanitizeString(input, options = {}) {
  if (input === null || input === undefined) {
    return options.defaultValue || "";
  }

  // Convert to string
  let sanitized = String(input);

  // Check length limits
  const maxLength = options.maxLength || CONFIG.MAX_STRING_LENGTH;
  if (sanitized.length > maxLength) {
    logger.warn(`String exceeds max length: ${sanitized.length} > ${maxLength}`);
    sanitized = sanitized.substring(0, maxLength);
  }

  // Remove control characters (except newlines and tabs if allowed)
  if (!options.allowControlChars) {
    if (options.allowNewlines) {
      // Keep \n and \r\n, remove other control chars
      sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");
    } else {
      // Remove all control characters including newlines
      sanitized = sanitized.replace(DANGEROUS_PATTERNS.CONTROL_CHARS, "");
    }
  }

  // Remove null bytes
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.NULL_BYTE, "");

  // Remove HTML/Script tags if not explicitly allowed
  if (!options.allowHtml) {
    sanitized = sanitized.replace(DANGEROUS_PATTERNS.SCRIPT_TAGS, "");
    sanitized = sanitized.replace(DANGEROUS_PATTERNS.HTML_TAGS, "");
    sanitized = sanitized.replace(DANGEROUS_PATTERNS.EVENT_HANDLERS, "");
  }

  // Trim whitespace unless specified otherwise
  if (!options.preserveWhitespace) {
    sanitized = sanitized.trim();
  }

  return sanitized;
}

/**
 * Sanitize text content (allows newlines, longer length)
 * @param {string} input - The text content
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized text
 */
function sanitizeText(input, options = {}) {
  return sanitizeString(input, {
    ...options,
    maxLength: options.maxLength || CONFIG.MAX_TEXT_LENGTH,
    allowNewlines: true,
  });
}

/**
 * Sanitize email address
 * @param {string} email - Email address
 * @returns {string} Sanitized email
 */
function sanitizeEmail(email) {
  if (!email) return "";

  let sanitized = String(email).toLowerCase().trim();

  // Length check
  if (sanitized.length > CONFIG.MAX_EMAIL_LENGTH) {
    logger.warn(`Email exceeds max length: ${sanitized.length}`);
    throw new Error("Email address is too long");
  }

  // Remove control characters
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.CONTROL_CHARS, "");
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.NULL_BYTE, "");

  // Remove any HTML tags or scripts
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.SCRIPT_TAGS, "");
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.HTML_TAGS, "");

  // Basic email format validation
  const emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
  
  if (!emailRegex.test(sanitized)) {
    throw new Error("Invalid email format");
  }

  return sanitized;
}

/**
 * Sanitize username
 * @param {string} username - Username
 * @returns {string} Sanitized username
 */
function sanitizeUsername(username) {
  if (!username) return "";

  let sanitized = String(username).trim();

  // Length check
  if (sanitized.length > CONFIG.MAX_USERNAME_LENGTH) {
    logger.warn(`Username exceeds max length: ${sanitized.length}`);
    throw new Error("Username is too long");
  }

  // Remove control characters
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.CONTROL_CHARS, "");
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.NULL_BYTE, "");

  // Remove any HTML tags or scripts
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.SCRIPT_TAGS, "");
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.HTML_TAGS, "");

  // Alphanumeric, underscore, and hyphen only
  sanitized = sanitized.replace(/[^a-zA-Z0-9_-]/g, "");

  return sanitized;
}

/**
 * Sanitize password (minimal sanitization, preserve special chars)
 * @param {string} password - Password
 * @returns {string} Sanitized password
 */
function sanitizePassword(password) {
  if (!password) return "";

  let sanitized = String(password);

  // Length check
  if (sanitized.length > CONFIG.MAX_PASSWORD_LENGTH) {
    logger.warn(`Password exceeds max length: ${sanitized.length}`);
    throw new Error("Password is too long");
  }

  // Remove only null bytes and control chars (preserve special chars for password strength)
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.NULL_BYTE, "");
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, "");

  return sanitized;
}

/**
 * Sanitize URL
 * @param {string} url - URL to sanitize
 * @returns {string} Sanitized URL
 */
function sanitizeUrl(url) {
  if (!url) return "";

  let sanitized = String(url).trim();

  // Length check
  if (sanitized.length > CONFIG.MAX_URL_LENGTH) {
    logger.warn(`URL exceeds max length: ${sanitized.length}`);
    throw new Error("URL is too long");
  }

  // Remove control characters
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.CONTROL_CHARS, "");
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.NULL_BYTE, "");

  // Check for malicious protocols
  if (
    DANGEROUS_PATTERNS.JAVASCRIPT_PROTOCOL.test(sanitized) ||
    DANGEROUS_PATTERNS.DATA_PROTOCOL.test(sanitized) ||
    DANGEROUS_PATTERNS.VBSCRIPT_PROTOCOL.test(sanitized) ||
    DANGEROUS_PATTERNS.FILE_PROTOCOL.test(sanitized)
  ) {
    logger.warn(`Malicious protocol detected in URL: ${sanitized.substring(0, 50)}`);
    throw new Error("Invalid URL protocol");
  }

  // Validate protocol is safe
  try {
    const urlObj = new URL(sanitized);
    if (!SAFE_PROTOCOLS.includes(urlObj.protocol)) {
      throw new Error("Unsafe URL protocol");
    }
  } catch (error) {
    logger.warn(`Invalid URL format: ${error.message}`);
    throw new Error("Invalid URL format");
  }

  return sanitized;
}

/**
 * Sanitize filename
 * @param {string} filename - Filename to sanitize
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  if (!filename) return "";

  let sanitized = String(filename).trim();

  // Length check
  if (sanitized.length > CONFIG.MAX_FILENAME_LENGTH) {
    logger.warn(`Filename exceeds max length: ${sanitized.length}`);
    throw new Error("Filename is too long");
  }

  // Remove control characters
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.CONTROL_CHARS, "");
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.NULL_BYTE, "");

  // Check for path traversal
  if (DANGEROUS_PATTERNS.PATH_TRAVERSAL.test(sanitized)) {
    logger.warn(`Path traversal detected in filename: ${sanitized}`);
    throw new Error("Invalid filename: path traversal detected");
  }

  // Remove potentially dangerous characters
  // Allow alphanumeric, spaces, dots, hyphens, underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9.\-_ ]/g, "");

  // Prevent multiple dots (could be used for directory traversal)
  sanitized = sanitized.replace(/\.{2,}/g, ".");

  // Prevent starting with dot (hidden files)
  sanitized = sanitized.replace(/^\.+/, "");

  return sanitized;
}

/**
 * Sanitize JSON payload
 * @param {Object} json - JSON object to sanitize
 * @param {Object} options - Sanitization options
 * @returns {Object} Sanitized JSON object
 */
function sanitizeJson(json, options = {}) {
  if (json === null || json === undefined) {
    return options.defaultValue || {};
  }

  // Convert to string to check size
  const jsonString = JSON.stringify(json);
  if (jsonString.length > CONFIG.MAX_JSON_LENGTH) {
    logger.warn(`JSON payload exceeds max length: ${jsonString.length}`);
    throw new Error("JSON payload is too large");
  }

  // Recursively sanitize all string values
  const sanitizeValue = (value) => {
    if (typeof value === "string") {
      return sanitizeString(value, options);
    } else if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    } else if (typeof value === "object" && value !== null) {
      const sanitized = {};
      for (const key in value) {
        // Sanitize keys as well
        const sanitizedKey = sanitizeString(key, { maxLength: 100 });
        sanitized[sanitizedKey] = sanitizeValue(value[key]);
      }
      return sanitized;
    }
    return value;
  };

  return sanitizeValue(json);
}

/**
 * Sanitize object with specific field rules
 * @param {Object} obj - Object to sanitize
 * @param {Object} rules - Sanitization rules for each field
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj, rules) {
  if (!obj || typeof obj !== "object") {
    return {};
  }

  const sanitized = {};

  for (const [field, rule] of Object.entries(rules)) {
    if (!(field in obj)) {
      // Field not provided, use default if specified
      if (rule.required) {
        throw new Error(`Required field missing: ${field}`);
      }
      if (rule.default !== undefined) {
        sanitized[field] = rule.default;
      }
      continue;
    }

    const value = obj[field];

    try {
      switch (rule.type) {
        case "string":
          sanitized[field] = sanitizeString(value, rule.options || {});
          break;
        case "text":
          sanitized[field] = sanitizeText(value, rule.options || {});
          break;
        case "email":
          sanitized[field] = sanitizeEmail(value);
          break;
        case "username":
          sanitized[field] = sanitizeUsername(value);
          break;
        case "password":
          sanitized[field] = sanitizePassword(value);
          break;
        case "url":
          sanitized[field] = sanitizeUrl(value);
          break;
        case "filename":
          sanitized[field] = sanitizeFilename(value);
          break;
        case "number":
          sanitized[field] = Number(value);
          if (isNaN(sanitized[field])) {
            throw new Error(`Invalid number: ${field}`);
          }
          break;
        case "boolean":
          sanitized[field] = Boolean(value);
          break;
        case "array":
          if (!Array.isArray(value)) {
            throw new Error(`Expected array for field: ${field}`);
          }
          sanitized[field] = value.map((item) => {
            if (rule.itemType) {
              return sanitizeString(item, rule.options || {});
            }
            return item;
          });
          break;
        case "json":
          sanitized[field] = sanitizeJson(value, rule.options || {});
          break;
        default:
          sanitized[field] = value;
      }
    } catch (error) {
      logger.error(`Sanitization error for field ${field}: ${error.message}`);
      throw new Error(`Invalid input for field ${field}: ${error.message}`);
    }
  }

  return sanitized;
}

/**
 * Detect potential SQL injection attempts
 * @param {string} input - Input to check
 * @returns {boolean} True if potential SQL injection detected
 */
function detectSqlInjection(input) {
  if (typeof input !== "string") return false;
  return DANGEROUS_PATTERNS.SQL_INJECTION.test(input);
}

/**
 * Detect potential XSS attempts
 * @param {string} input - Input to check
 * @returns {boolean} True if potential XSS detected
 */
function detectXss(input) {
  if (typeof input !== "string") return false;
  
  return (
    DANGEROUS_PATTERNS.SCRIPT_TAGS.test(input) ||
    DANGEROUS_PATTERNS.EVENT_HANDLERS.test(input) ||
    DANGEROUS_PATTERNS.JAVASCRIPT_PROTOCOL.test(input)
  );
}

/**
 * Detect potential path traversal attempts
 * @param {string} input - Input to check
 * @returns {boolean} True if potential path traversal detected
 */
function detectPathTraversal(input) {
  if (typeof input !== "string") return false;
  return DANGEROUS_PATTERNS.PATH_TRAVERSAL.test(input);
}

/**
 * Comprehensive security scan
 * @param {string} input - Input to scan
 * @returns {Object} Scan results
 */
function securityScan(input) {
  const results = {
    safe: true,
    threats: [],
  };

  if (detectXss(input)) {
    results.safe = false;
    results.threats.push("XSS");
  }

  if (detectSqlInjection(input)) {
    results.safe = false;
    results.threats.push("SQL_INJECTION");
  }

  if (detectPathTraversal(input)) {
    results.safe = false;
    results.threats.push("PATH_TRAVERSAL");
  }

  if (DANGEROUS_PATTERNS.NULL_BYTE.test(input)) {
    results.safe = false;
    results.threats.push("NULL_BYTE");
  }

  return results;
}

module.exports = {
  sanitizeString,
  sanitizeText,
  sanitizeEmail,
  sanitizeUsername,
  sanitizePassword,
  sanitizeUrl,
  sanitizeFilename,
  sanitizeJson,
  sanitizeObject,
  detectSqlInjection,
  detectXss,
  detectPathTraversal,
  securityScan,
  CONFIG,
};
