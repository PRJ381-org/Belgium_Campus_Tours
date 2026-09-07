const express = require('express');
const { getDownloadInfo, handleDownloadRedirect } = require('../controllers/download.controller');

const router = express.Router();

// GET /api/downloads/info -> Public build metadata, release notes & URLs
router.get('/info', getDownloadInfo);

// GET /api/downloads/:platform -> Telemetry capture & CDN redirect (windows, android, quest)
router.get('/:platform', handleDownloadRedirect);

module.exports = router;
