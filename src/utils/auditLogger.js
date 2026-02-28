const logger = require("./logger");

const logAudit = async (action, userId, metadata = {}) => {
  logger.info("Audit Event", { action, userId, timestamp: new Date(), ...metadata });
};

module.exports = { logAudit };
