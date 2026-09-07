const AnalyticsEvent = require('../models/AnalyticsEvent');
const asyncHandler = require('../utils/asyncHandler');

// Default build specifications and distribution endpoints
const BUILD_INFO = {
  version: '1.0.0',
  releaseDate: '2026-09-06',
  platforms: {
    windows: {
      platform: 'windows',
      name: 'Windows Desktop PC',
      tagline: 'DirectX 12 / High-Fidelity Desktop & PCVR',
      filename: 'PRJ381-Windows-v1.0.0.zip',
      size: '1.4 GB',
      format: '.zip (Staged Executable)',
      downloadUrl: '/api/downloads/windows',
      cdnUrl: process.env.DOWNLOAD_URL_WINDOWS || 'https://github.com/PRJ381-org/PRJ381/releases/download/v1.0.0/PRJ381-Windows-v1.0.0.zip',
      requirements: {
        os: 'Windows 10 / 11 64-bit',
        gpu: 'NVIDIA GTX 1060 / AMD RX 580 (DX12)',
        ram: '8 GB RAM (16 GB recommended)',
        storage: '3.0 GB free disk space',
      },
      instructions: [
        'Download the Windows ZIP archive.',
        'Right-click the downloaded file and select Extract All...',
        'Open the extracted folder and double-click PRJ381.exe to launch.',
      ],
    },
    android: {
      platform: 'android',
      name: 'Android Mobile',
      tagline: 'Touchscreen Virtual Joystick Exploration',
      filename: 'PRJ381-Mobile-v1.0.0.apk',
      size: '750 MB',
      format: '.apk (Standalone Package)',
      downloadUrl: '/api/downloads/android',
      cdnUrl: process.env.DOWNLOAD_URL_ANDROID || 'https://github.com/PRJ381-org/PRJ381/releases/download/v1.0.0/PRJ381-Mobile-v1.0.0.apk',
      requirements: {
        os: 'Android 10.0 (API 29) or higher',
        ram: '4 GB RAM minimum',
        storage: '1.5 GB free disk space',
      },
      instructions: [
        'Download the APK directly or scan the on-screen QR Code with your phone.',
        'When prompted by Android, tap Download anyway.',
        'Open the APK and enable "Install unknown apps" in Settings to install.',
      ],
    },
    quest: {
      platform: 'quest',
      name: 'Meta Quest VR',
      tagline: '6DoF Standalone Meta Quest 2 / Quest 3 VR',
      filename: 'PRJ381-Quest3-v1.0.0.apk',
      size: '850 MB',
      format: '.apk (ASTC VR Build)',
      downloadUrl: '/api/downloads/quest',
      cdnUrl: process.env.DOWNLOAD_URL_QUEST || 'https://github.com/PRJ381-org/PRJ381/releases/download/v1.0.0/PRJ381-Quest3-v1.0.0.apk',
      installerUrl: process.env.DOWNLOAD_URL_QUEST_INSTALLER || 'https://github.com/PRJ381-org/PRJ381/releases/download/v1.0.0/PRJ381-Quest3-Installer.zip',
      requirements: {
        headset: 'Meta Quest 2 / Meta Quest 3 / Meta Quest Pro',
        tracking: '6DoF Touch Controllers / Hand Tracking',
        storage: '2.0 GB free headset storage',
      },
      instructions: [
        'Option A (SideQuest): Drag and drop the APK into SideQuest on PC.',
        'Option B (1-Click ADB): Connect Quest to PC with USB cable and run Install_PRJ381-Quest3.bat.',
        'Option C (Quest Browser): Download directly inside headset and install via Files app.',
      ],
    },
  },
};

/**
 * GET /api/downloads/info
 * Returns public metadata, release specs, and download URLs.
 */
exports.getDownloadInfo = (req, res) => {
  res.json({
    success: true,
    version: BUILD_INFO.version,
    releaseDate: BUILD_INFO.releaseDate,
    platforms: BUILD_INFO.platforms,
  });
};

/**
 * GET /api/downloads/:platform
 * Ingests a game_download telemetry event and redirects (302) to the binary asset.
 */
exports.handleDownloadRedirect = asyncHandler(async (req, res) => {
  const platformKey = (req.params.platform || '').toLowerCase();
  const target = BUILD_INFO.platforms[platformKey];

  if (!target) {
    return res.status(400).json({
      success: false,
      message: `Invalid platform '${req.params.platform}'. Expected 'windows', 'android', or 'quest'.`,
    });
  }

  // Non-blocking telemetry ingestion
  AnalyticsEvent.create({
    sessionId: req.query.sessionId || `web-dl-${Date.now()}`,
    eventType: 'game_download',
    area: 'WebDownloadPortal',
    hotspotId: `${platformKey}_build`,
    durationMs: 0,
    seq: 1,
  }).catch((err) => {
    // Quietly log telemetry write errors so download redirects are never blocked
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`Download telemetry logging skipped: ${err.message}`);
    }
  });

  // Redirect to CDN binary location
  const destination = target.cdnUrl;
  res.redirect(302, destination);
});

exports.BUILD_INFO = BUILD_INFO;
