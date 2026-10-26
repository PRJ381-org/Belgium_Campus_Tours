const path = require('path');
const fs = require('fs');
const AnalyticsEvent = require('../models/AnalyticsEvent');

const BUILDS_DIR = path.join(__dirname, '../../builds');

// Authoritative build files and fallback candidates
const PLATFORM_MAP = {
  desktop: {
    externalUrlEnv: 'DOWNLOAD_URL_WINDOWS',
    downloadName: 'BCI_Campus_Tour-Windows.zip',
    contentType: 'application/zip',
    candidates: [
      path.join(BUILDS_DIR, 'BCI_Campus_Tour-Windows.zip'),
      path.join(__dirname, '../../../Builds/BCI_Campus_Tour-Windows.zip'),
      path.join(BUILDS_DIR, 'Windows.zip'),
    ],
  },
  windows: {
    externalUrlEnv: 'DOWNLOAD_URL_WINDOWS',
    downloadName: 'BCI_Campus_Tour-Windows.zip',
    contentType: 'application/zip',
    candidates: [
      path.join(BUILDS_DIR, 'BCI_Campus_Tour-Windows.zip'),
      path.join(__dirname, '../../../Builds/BCI_Campus_Tour-Windows.zip'),
      path.join(BUILDS_DIR, 'Windows.zip'),
    ],
  },
  mobile: {
    externalUrlEnv: 'DOWNLOAD_URL_ANDROID',
    downloadName: 'BCI_Campus_Tour-Android.apk',
    contentType: 'application/vnd.android.package-archive',
    candidates: [
      path.join(BUILDS_DIR, 'BCI_Campus_Tour-Android.apk'),
      path.join(__dirname, '../../../Builds/Download/Android_ASTC/PRJ381-arm64.apk'),
      path.join(__dirname, '../../../Builds/BCI_Campus_Tour-Android.apk'),
    ],
  },
  android: {
    externalUrlEnv: 'DOWNLOAD_URL_ANDROID',
    downloadName: 'BCI_Campus_Tour-Android.apk',
    contentType: 'application/vnd.android.package-archive',
    candidates: [
      path.join(BUILDS_DIR, 'BCI_Campus_Tour-Android.apk'),
      path.join(__dirname, '../../../Builds/Download/Android_ASTC/PRJ381-arm64.apk'),
      path.join(__dirname, '../../../Builds/BCI_Campus_Tour-Android.apk'),
    ],
  },
};

// Builds hosted elsewhere (e.g. Google Drive): set DOWNLOAD_URL_WINDOWS /
// DOWNLOAD_URL_ANDROID in hPanel and the buttons redirect there instead of
// streaming from builds/. Only absolute https links count, so a relative
// default can never loop back to this route.
function externalUrl(target) {
  const url = (process.env[target.externalUrlEnv] || '').trim();
  return url.startsWith('https://') ? url : null;
}

function logDownload(req, platform) {
  // Non-blocking telemetry ingestion
  AnalyticsEvent.create({
    sessionId: req.query.sessionId || `web-dl-${Date.now()}`,
    eventType: 'game_download',
    area: 'WebDownloadPortal',
    hotspotId: `${platform}_build`,
    durationMs: 0,
    seq: 1,
  }).catch(() => {});
}

exports.downloadBuild = (req, res) => {
  const platform = (req.params.platform || '').toLowerCase();

  if (platform === 'vr' || platform === 'quest') {
    return res.status(410).json({
      success: false,
      message: 'Do not ship anything from Builds\\Quest3\\ — that APK crashes on launch (Failed to find shader map for default material WorldGridMaterial). Use the Android APK (BCI_Campus_Tour-Android.apk) or Windows build instead.',
    });
  }

  const target = PLATFORM_MAP[platform];
  if (!target) {
    return res.status(400).send('Invalid platform requested. Use desktop/windows or mobile/android.');
  }

  const redirectTo = externalUrl(target);
  if (redirectTo) {
    logDownload(req, platform);
    return res.redirect(302, redirectTo);
  }

  const filePath = target.candidates.find((candidate) => fs.existsSync(candidate));

  if (!filePath) {
    return res.status(404).send(`Build file (${target.downloadName}) not found on the server.`);
  }

  logDownload(req, platform);

  const stat = fs.statSync(filePath);
  res.setHeader('Content-Disposition', `attachment; filename="${target.downloadName}"`);
  res.setHeader('Content-Type', target.contentType);
  res.setHeader('Content-Length', stat.size);

  const readStream = fs.createReadStream(filePath);
  readStream.pipe(res);

  readStream.on('error', (err) => {
    console.error('Stream error:', err);
    if (!res.headersSent) {
      res.status(500).send('Error streaming the build.');
    }
  });
};
