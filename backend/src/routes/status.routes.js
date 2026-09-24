const express = require('express');
const { getStatus } = require('../controllers/status.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

const router = express.Router();

// GET /api/status -> System Status page (admin/master). Deliberately NOT behind
// requireDb: its whole job is to report a database outage, not fail because of one.
router.get('/', requireAuth, requireRole(['admin', 'master']), getStatus);

module.exports = router;
