const AnalyticsEvent = require('../models/AnalyticsEvent');
const asyncHandler = require('../utils/asyncHandler');

// Default build specifications and distribution endpoints
const BUILD_INFO = {
  version: '1.0.0',
  releaseDate: '2026-10-26',
  platforms: {
    windows: {
      platform: 'windows',
      name: 'Windows Desktop PC',
      tagline: 'DirectX 12 / Shader Model 6 (Lumen & Virtual Shadow Maps)',
      filename: 'BCI_Campus_Tour-Windows.zip',
      size: '3.92 GB (4,204,892,805 B, 71 files)',
      format: '.zip (Folder Archive — Extract All before running)',
      downloadUrl: '/api/downloads/windows',
      directDownloadUrl: '/api/download/desktop',
      cdnUrl: process.env.DOWNLOAD_URL_WINDOWS || '/api/download/desktop',
      archiveRootLayout: ['PRJ381.exe', 'Engine\\', 'PRJ381\\', 'NOTICES.txt'],
      requirements: {
        os: 'Windows 10 / 11 64-bit',
        gpu: 'Shader Model 6 capable GPU (Lumen & Virtual Shadow Maps enabled globally)',
        configuration: 'Development configuration build (~4 GB with debug symbols)',
        storage: '7.8 GB total free space (3.92 GB archive + 3.92 GB extracted)',
      },
      instructions: [
        'Download BCI_Campus_Tour-Windows.zip (3.92 GB) and ensure ~7.8 GB of free disk space.',
        'Extract it fully — right-click -> Extract All. Do not double-click into the ZIP and run PRJ381.exe from inside the archive, or it will fail to find Engine\\ and PRJ381\\.',
        'Run PRJ381.exe. When Windows SmartScreen shows "Windows protected your PC", click More info -> Run anyway (expected for an unsigned executable).',
        'Keep NOTICES.txt in the folder — it contains the engine third-party attributions required for distribution.',
      ],
    },
    android: {
      platform: 'android',
      name: 'Android Mobile',
      tagline: 'Single self-contained ASTC APK (Content, OBB & shader libraries included)',
      filename: 'BCI_Campus_Tour-Android.apk',
      size: '2.12 GB (2,119,149,788 B)',
      format: '.apk (Single self-contained file — Do NOT zip)',
      downloadUrl: '/api/downloads/android',
      directDownloadUrl: '/api/download/mobile',
      cdnUrl: process.env.DOWNLOAD_URL_ANDROID || '/api/download/mobile',
      requirements: {
        os: 'Android 12L (API 32) or newer (MinSDKVersion=32 hard floor)',
        cpu: 'arm64 CPU (excludes 32-bit devices)',
        gpu: 'Vulkan-capable GPU',
        storage: '~4.3 GB free space (2.12 GB download + ~2.12 GB during installation; download over Wi-Fi)',
      },
      instructions: [
        'Check your phone qualifies: Android 12L (API 32)+, arm64 CPU, Vulkan GPU, and ~4.3 GB free space over Wi-Fi.',
        'Tap the download link. In Chrome, confirm "This type of file can harm your device. Do you want to keep BCI_Campus_Tour-Android.apk anyway?" -> Download anyway.',
        'Open the APK from Downloads. When prompted "For your security, your phone is not allowed to install unknown apps from this source", tap Settings -> enable Allow from this source -> go back -> Install.',
        'Bypass Play Protect (debug-signed build): when "Unsafe app blocked" or "App scan recommended" appears, tap More details -> Install anyway.',
        'Tap Open or launch BCI_Campus_Tour from your app drawer (ApplicationDisplayName=BCI_Campus_Tour, not PRJ381).',
        'On first launch, allow permission prompts and wait ~6s+ while first-boot PSO shaders compile.',
      ],
      updateWarnings: [
        'Signed with Unreal Engine shared debug key (no Keystore* config): installing a newer APK over an older one only works if both were built with the exact same debug key. Otherwise Android throws INSTALL_FAILED_UPDATE_INCOMPATIBLE and you must uninstall first (wiping local data).',
        'Public debug-signed downloads cannot later be upgraded in-place to a release-signed build without uninstalling first.',
      ],
    },
    quest: {
      platform: 'quest',
      deprecated: true,
      status: 'do_not_ship',
      name: 'Meta Quest 3 (Retired / Do Not Ship)',
      tagline: 'Disabled — Builds\\Quest3\\ crashes on launch (missing WorldGridMaterial shader map)',
      filename: 'PRJ381-Quest3-v1.0.0.apk',
      size: 'N/A (Do Not Ship)',
      format: '.apk (Deprecated)',
      downloadUrl: '/api/downloads/quest',
      cdnUrl: process.env.DOWNLOAD_URL_QUEST || 'https://github.com/PRJ381-org/PRJ381/releases/download/v1.0.0/PRJ381-Quest3-v1.0.0.apk',
      requirements: {
        headset: 'Do not ship Builds\\Quest3\\ — APK crashes on launch (Failed to find shader map for default material WorldGridMaterial) and main.1.com.YourCompany.PRJ381.obb (1.99 GB) is a stale leftover.',
      },
      instructions: [
        'Do not ship anything from Builds\\Quest3\\.',
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
