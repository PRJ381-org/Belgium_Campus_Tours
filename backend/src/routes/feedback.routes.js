const express = require('express');
const { listFeedback } = require('../controllers/feedback.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

const router = express.Router();

// Deliberately NOT behind requireDb: feedback is read from Google Sheets, not
// MongoDB, so this panel keeps working during a database outage.
router.get('/', requireAuth, requireRole(['admin', 'master']), listFeedback);

module.exports = router;
