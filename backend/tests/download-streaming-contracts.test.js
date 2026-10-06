/**
 * Automated Contract Tests for Direct Build File Streaming.
 *
 * Verifies:
 * - Direct build download controller (backend/src/controllers/downloadBuildControllers.js)
 * - Platform parameter mapping (desktop -> Windows.zip, mobile -> Android.zip, vr -> Quest3.zip)
 * - Strict 400 rejection for unsupported platforms and path traversal attempts
 * - 404 response when build binaries are absent from disk
 * - End-to-end streaming headers (Content-Disposition, Content-Type) and payload delivery
 */
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');

describe('GET /api/download/:platform (Direct Binary Streaming)', () => {
  const buildsDir = path.join(__dirname, '../builds');
  const dummyZipPath = path.join(buildsDir, 'Windows.zip');
  let createdDummy = false;

  afterAll(() => {
    if (createdDummy && fs.existsSync(dummyZipPath)) {
      try {
        fs.unlinkSync(dummyZipPath);
      } catch {
        // ignore
      }
    }
  });

  describe('Platform Validation & Rejection', () => {
    test('returns 400 for unknown platform string', async () => {
      const res = await request(app).get('/api/download/playstation');
      expect(res.status).toBe(400);
      expect(res.text).toBe('Invalid platform requested.');
    });

    test('returns 400 for alternate route syntax (e.g. windows vs desktop)', async () => {
      // /api/downloads/:platform accepts 'windows', but /api/download/:platform strictly requires 'desktop'
      const res = await request(app).get('/api/download/windows');
      expect(res.status).toBe(400);
      expect(res.text).toBe('Invalid platform requested.');
    });

    test('strictly defends against path traversal in platform parameter', async () => {
      const res1 = await request(app).get('/api/download/..%2f..%2fpackage.json');
      expect(res1.status).toBe(400);

      const res2 = await request(app).get('/api/download/%2e%2e%2f');
      expect(res2.status).toBe(400);
    });
  });

  describe('Missing File Handling', () => {
    test('returns 404 when valid platform build does not exist on disk', async () => {
      // Ensure file does not exist
      if (fs.existsSync(dummyZipPath)) fs.unlinkSync(dummyZipPath);

      const res = await request(app).get('/api/download/desktop');
      expect(res.status).toBe(404);
      expect(res.text).toBe('Build file not found on the server.');
    });

    test('returns 404 for missing mobile build', async () => {
      const res = await request(app).get('/api/download/mobile');
      expect(res.status).toBe(404);
      expect(res.text).toBe('Build file not found on the server.');
    });

    test('returns 404 for missing vr build', async () => {
      const res = await request(app).get('/api/download/vr');
      expect(res.status).toBe(404);
      expect(res.text).toBe('Build file not found on the server.');
    });
  });

  describe('Successful File Streaming Pipe', () => {
    test('streams binary package with correct attachment headers when file exists', async () => {
      if (!fs.existsSync(buildsDir)) fs.mkdirSync(buildsDir, { recursive: true });
      const dummyContent = 'PK\x03\x04-dummy-zip-binary-stream-test';
      fs.writeFileSync(dummyZipPath, dummyContent, 'utf8');
      createdDummy = true;

      const res = await request(app).get('/api/download/desktop');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/zip');
      expect(res.headers['content-disposition']).toBe('attachment; filename="Windows.zip"');
      expect(res.text).toBe(dummyContent);
    });
  });
});
