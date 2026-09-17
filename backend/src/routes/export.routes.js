const express = require('express');
const {
  exportLeadsCsv,
  exportAnalyticsCsv,
  exportSummaryCsv,
} = require('../controllers/export.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const requireDb = require('../middlewares/requireDb');

const router = express.Router();

// requireDb sits last on each of these: an anonymous or under-privileged caller
// must still be answered 401/403, not told about our database state.

// GET /api/export/summary (Admin only)
router.get('/summary', requireAuth, requireRole(['admin', 'master']), requireDb, exportSummaryCsv);

// GET /api/export/leads (Admin only)
router.get('/leads', requireAuth, requireRole(['admin', 'master']), requireDb, exportLeadsCsv);

// GET /api/export/analytics (Admin only)
router.get('/analytics', requireAuth, requireRole(['admin', 'master']), requireDb, exportAnalyticsCsv);

module.exports = router;
