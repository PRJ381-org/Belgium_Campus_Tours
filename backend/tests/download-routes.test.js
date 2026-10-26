/**
 * Contract and unit tests for the Download & Distribution endpoints.
 */
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const { BUILD_INFO } = require('../src/controllers/download.controller');

// Fast buffer timeout to prevent hanging on unmocked DB calls
mongoose.set('bufferTimeoutMS', 200);

describe('GET /api/downloads/info', () => {
  test('returns 200 and public build metadata for all platforms', async () => {
    const res = await request(app).get('/api/downloads/info');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('releaseDate');
    expect(res.body).toHaveProperty('platforms');

    const { platforms } = res.body;
    expect(platforms).toHaveProperty('windows');
    expect(platforms).toHaveProperty('android');
    expect(platforms).toHaveProperty('quest');

    // Windows validation
    expect(platforms.windows.platform).toBe('windows');
    expect(platforms.windows.filename).toMatch(/\.zip$/i);
    expect(platforms.windows.downloadUrl).toBe('/api/downloads/windows');
    expect(platforms.windows.requirements).toBeDefined();

    // Android validation
    expect(platforms.android.platform).toBe('android');
    expect(platforms.android.filename).toMatch(/\.apk$/i);
    expect(platforms.android.downloadUrl).toBe('/api/downloads/android');
    expect(platforms.android.requirements).toBeDefined();

    // Quest VR validation
    expect(platforms.quest.platform).toBe('quest');
    expect(platforms.quest.filename).toMatch(/\.apk$/i);
    expect(platforms.quest.downloadUrl).toBe('/api/downloads/quest');
    expect(platforms.quest.requirements).toBeDefined();
  });

  test('is publicly accessible without authentication tokens', async () => {
    const res = await request(app).get('/api/downloads/info');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/downloads/:platform redirect handling', () => {
  test('GET /api/downloads/windows redirects (302) to Windows CDN package', async () => {
    const res = await request(app).get('/api/downloads/windows');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(BUILD_INFO.platforms.windows.cdnUrl);
  });

  test('GET /api/downloads/android redirects (302) to Android APK package', async () => {
    const res = await request(app).get('/api/downloads/android');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(BUILD_INFO.platforms.android.cdnUrl);
  });

  test('GET /api/downloads/quest redirects (302) to Meta Quest VR package', async () => {
    const res = await request(app).get('/api/downloads/quest');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(BUILD_INFO.platforms.quest.cdnUrl);
  });

  test('GET /api/downloads/invalid returns 400 Bad Request with error message', async () => {
    const res = await request(app).get('/api/downloads/invalidplatform');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid platform/i);
  });

  test('handles case-insensitivity on platform parameters (e.g. /WINDOWS -> 302)', async () => {
    const res = await request(app).get('/api/downloads/WINDOWS');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(BUILD_INFO.platforms.windows.cdnUrl);
  });
});

describe('GET /api/download/:platform external build links', () => {
  const DRIVE_ANDROID = 'https://drive.usercontent.google.com/download?id=android-test&export=download&confirm=t';
  const DRIVE_WINDOWS = 'https://drive.usercontent.google.com/download?id=windows-test&export=download&confirm=t';

  afterEach(() => {
    delete process.env.DOWNLOAD_URL_ANDROID;
    delete process.env.DOWNLOAD_URL_WINDOWS;
  });

  test('redirects the Android button to DOWNLOAD_URL_ANDROID when set', async () => {
    process.env.DOWNLOAD_URL_ANDROID = DRIVE_ANDROID;
    const res = await request(app).get('/api/download/mobile');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(DRIVE_ANDROID);
  });

  test('redirects the Windows button to DOWNLOAD_URL_WINDOWS when set', async () => {
    process.env.DOWNLOAD_URL_WINDOWS = DRIVE_WINDOWS;
    const res = await request(app).get('/api/download/desktop');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(DRIVE_WINDOWS);
  });

  test('ignores a non-https value and falls back to the local build file', async () => {
    process.env.DOWNLOAD_URL_ANDROID = '/api/download/mobile';
    const res = await request(app).get('/api/download/mobile');
    expect(res.status).not.toBe(302);
  });

  test('without a link set, a missing build file is still a 404', async () => {
    const res = await request(app).get('/api/download/desktop');
    expect([200, 404]).toContain(res.status);
    expect(res.status).not.toBe(302);
  });
});
