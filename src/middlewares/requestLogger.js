const morgan = require("morgan");
const logger = require("../utils/logger");

morgan.token("user-id", (req) => req.user?.id || "anonymous");

const logFormat = ':remote-addr :user-id ":method :url" :status :response-time ms';

const requestLogger = morgan(logFormat, {
  stream: { write: (message) => logger.http(message.trim()) },
});

module.exports = requestLogger;
