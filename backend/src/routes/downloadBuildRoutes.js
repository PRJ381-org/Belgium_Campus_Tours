const express = require('express');
const router = express.Router();
const { downloadBuild } = require('../controllers/downloadBuildControllers');

// The :platform parameter will catch 'desktop', 'mobile', or 'vr'
router.get('/:platform', downloadBuild);

module.exports = router;