const express = require("express");
const router = express.Router();
const { analyticsDashboard } = require("../controllers/admin.controller");
const { authenticate, authorizeAdmin } = require("../middlewares/auth.middleware");

// Only admin can access
router.get("/analytics", authenticate, authorizeAdmin, analyticsDashboard);

module.exports = router;