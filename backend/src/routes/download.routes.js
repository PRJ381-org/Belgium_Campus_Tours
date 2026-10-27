const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../utils/validate');
const { requireAuth } = require('../middlewares/auth.middleware');
const requireDb = require('../middlewares/requireDb');
const DownloadClick = require('../models/DownloadClick');
const {
  getDownloadInfo,
  handleDownloadRedirect,
  recordDownloadClick,
  getDownloadClicks,
} = require('../controllers/download.controller');

const router = express.Router();

// Loose for the same reason as leads: a room full of visitors shares one NAT'd IP.
const clickLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again shortly.' },
});

// GET /api/downloads/info -> Public build metadata, release notes & URLs
router.get('/info', getDownloadInfo);

// POST /api/downloads/clicks -> landing-page Download button was clicked (public)
router.post(
  '/clicks',
  clickLimiter,
  [body('platform').isIn(DownloadClick.PLATFORMS).withMessage(`platform must be one of: ${DownloadClick.PLATFORMS.join(', ')}`)],
  validate,
  requireDb,
  recordDownloadClick
);

// GET /api/downloads/clicks -> click counts per platform (dashboard). Registered
// before /:platform so "clicks" is never mistaken for a platform name.
router.get('/clicks', requireAuth, requireDb, getDownloadClicks);

// GET /api/downloads/:platform -> Telemetry capture & CDN redirect (windows, android, quest)
router.get('/:platform', handleDownloadRedirect);

module.exports = router;
