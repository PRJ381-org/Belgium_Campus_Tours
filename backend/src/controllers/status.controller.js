const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const { dbState } = require('../db');
const { NODE_ENV } = require('../config/env');
const { version } = require('../../package.json');
const { BUILD_INFO } = require('./download.controller');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const Lead = require('../models/Lead');
const Feedback = require('../models/Feedback');
const Ticket = require('../models/Ticket');

const READY_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];
const startedAt = new Date().toISOString();

// The landing page's Download buttons use /api/download/:platform, which streams
// these files from backend/builds/ (see downloadBuildControllers.js).
const BUILDS_DIR = path.join(__dirname, '../../builds');
const PLATFORMS = [
  { key: 'vr', name: 'Meta Quest VR', file: 'Quest3.zip', release: 'quest' },
  { key: 'desktop', name: 'Windows PC', file: 'Windows.zip', release: 'windows' },
  { key: 'mobile', name: 'Android', file: 'Android.zip', release: 'android' },
];

// GitHub release links are checked from the server (the browser's CSP blocks
// calling github.com) and cached so the page's 30s refresh doesn't hammer GitHub.
const REMOTE_CACHE_MS = 5 * 60 * 1000;
let remoteCache = { at: 0, results: {} };

async function checkUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(6000) });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, status: null, error: err.name === 'TimeoutError' ? 'Timed out' : 'Unreachable' };
  }
}

async function remoteChecks() {
  // Tests must never reach the internet.
  if (NODE_ENV === 'test') return {};
  if (Date.now() - remoteCache.at < REMOTE_CACHE_MS) return remoteCache.results;
  const entries = await Promise.all(
    PLATFORMS.map(async (p) => {
      const url = BUILD_INFO.platforms[p.release]?.cdnUrl;
      return [p.key, url ? { url, ...(await checkUrl(url)) } : null];
    })
  );
  remoteCache = { at: Date.now(), results: Object.fromEntries(entries) };
  return remoteCache.results;
}

function localFile(file) {
  try {
    const stat = fs.statSync(path.join(BUILDS_DIR, file));
    return { present: true, sizeBytes: stat.size, modifiedAt: stat.mtime };
  } catch {
    return { present: false };
  }
}

async function databaseInfo() {
  const state = dbState();
  const info = { state: READY_STATES[state] || 'unknown', pingMs: null };
  if (state === 1) {
    const t0 = Date.now();
    try {
      await mongoose.connection.db.admin().ping();
      info.pingMs = Date.now() - t0;
    } catch {
      info.state = 'unresponsive';
    }
  }
  return info;
}

async function dataSnapshot(dbUp) {
  if (!dbUp) return null;
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [lastEvent, eventsLastHour, events24h, sessions24h, leads24h, feedback24h, ticketsNeedingReply] =
    await Promise.all([
      AnalyticsEvent.findOne().sort({ createdAt: -1 }).select('createdAt eventType').lean(),
      AnalyticsEvent.countDocuments({ createdAt: { $gte: hourAgo } }),
      AnalyticsEvent.countDocuments({ createdAt: { $gte: dayAgo } }),
      AnalyticsEvent.distinct('sessionId', { createdAt: { $gte: dayAgo } }).then((ids) => ids.length),
      Lead.countDocuments({ createdAt: { $gte: dayAgo } }),
      Feedback.countDocuments({ createdAt: { $gte: dayAgo } }),
      Ticket.countDocuments({ status: { $ne: 'resolved' }, lastMessageBy: 'visitor' }),
    ]);
  return {
    telemetry: {
      lastEventAt: lastEvent?.createdAt || null,
      lastEventType: lastEvent?.eventType || null,
      eventsLastHour,
      events24h,
      sessions24h,
    },
    activity: { leads24h, feedback24h, ticketsNeedingReply },
  };
}

// GET /api/status -> everything the System Status page shows (admin/master)
exports.getStatus = asyncHandler(async (req, res) => {
  const database = await databaseInfo();
  const [snapshot, remote] = await Promise.all([dataSnapshot(database.state === 'connected'), remoteChecks()]);

  res.json({
    success: true,
    checkedAt: new Date().toISOString(),
    server: {
      status: 'ok',
      version,
      env: NODE_ENV,
      commit: process.env.GITHUB_SHA || process.env.SCM_COMMIT_ID || null,
      node: process.version,
      startedAt,
      uptimeSeconds: Math.round(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
    database,
    telemetry: snapshot?.telemetry || null,
    activity: snapshot?.activity || null,
    downloads: {
      version: BUILD_INFO.version,
      releaseDate: BUILD_INFO.releaseDate,
      platforms: PLATFORMS.map((p) => ({
        key: p.key,
        name: p.name,
        landingPath: `/api/download/${p.key}`,
        file: p.file,
        local: localFile(p.file),
        github: remote[p.key] || null,
      })),
    },
  });
});
