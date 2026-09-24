const express = require('express');
const {
  exportLeadsCsv,
  exportAnalyticsCsv,
  exportSummaryCsv,
  exportFeedbackCsv,
  exportTicketsCsv,
  exportCounts,
} = require('../controllers/export.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const requireDb = require('../middlewares/requireDb');

const router = express.Router();

// requireDb sits last on each of these: an anonymous or under-privileged caller
// must still be answered 401/403, not told about our database state.
// Every export accepts ?timeframe=all|today|24h|7d|30d (see utils/timeframe.js).
const admin = [requireAuth, requireRole(['admin', 'master']), requireDb];

router.get('/summary', ...admin, exportSummaryCsv);
router.get('/leads', ...admin, exportLeadsCsv);
router.get('/analytics', ...admin, exportAnalyticsCsv);
router.get('/feedback', ...admin, exportFeedbackCsv);
router.get('/tickets', ...admin, exportTicketsCsv);

// GET /api/export/counts -> record counts for the Reports page
router.get('/counts', ...admin, exportCounts);

module.exports = router;
