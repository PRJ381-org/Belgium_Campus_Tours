const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

let mongod;
let app;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'release-readiness-test-secret-key-381';

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  app = require('../src/app');
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('Ticket 8: Final Polish & Release Readiness Audit', () => {
  // =========================================================================
  // 1. OWASP SECURITY HEADERS & DIRECTIVES AUDIT
  // =========================================================================
  describe('1. OWASP Security Headers & Browser Hardening', () => {
    test('enforces strict security headers via Helmet middleware', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      // MIME-sniffing defense
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      // Clickjacking defense
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      // Cross-origin process isolation
      expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
      // DNS prefetch defense
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
      // Download options for legacy IE
      expect(res.headers['x-download-options']).toBe('noopen');
      // Permitted cross domain policies
      expect(res.headers['x-permitted-cross-domain-policies']).toBe('none');
    });

    test('CSP (Content-Security-Policy) whitelists authorized CDNs while restricting untrusted sources', async () => {
      const res = await request(app).get('/');

      expect(res.headers).toHaveProperty('content-security-policy');
      const csp = res.headers['content-security-policy'];

      // Must permit self and jsdelivr for bundled chart and MSAL utilities
      expect(csp).toMatch(/script-src[^;]*'self'/);
      expect(csp).toMatch(/script-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
      // Must permit connection to Microsoft Entra for OAuth
      expect(csp).toMatch(/connect-src[^;]*https:\/\/login\.microsoftonline\.com/);
    });

    test('CORS allowlist: allows registered origin and withholds header from unauthorized origin', async () => {
      // 1. Allowed origin (matches CORS_ORIGIN allowlist configured in testEnv.js)
      const resAllowed = await request(app)
        .get('/health')
        .set('Origin', 'https://dashboard.example.com');

      expect(resAllowed.status).toBe(200);
      expect(resAllowed.headers['access-control-allow-origin']).toBe('https://dashboard.example.com');

      // 2. Disallowed origin (foreign/untrusted domain)
      const resBlocked = await request(app)
        .get('/health')
        .set('Origin', 'https://malicious-scam-site.org');

      expect(resBlocked.status).toBe(200);
      expect(resBlocked.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  // =========================================================================
  // 2. PRODUCTION HEALTH CHECK & DIAGNOSTICS CONTRACT
  // =========================================================================
  describe('2. Production Diagnostics & Health Contract', () => {
    test('GET /health satisfies operational monitoring contract', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('uptime');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.uptime).toBeGreaterThanOrEqual(0);
      expect(res.body).toHaveProperty('startedAt');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body.db).toBe('connected');
    });

    test('non-existent routes return clean structured 404 JSON, preventing stack trace leaks', async () => {
      const res = await request(app).get('/api/v1/invalid-route-probe');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
      // Ensure no internal stack trace or server directory paths are leaked
      expect(res.body).not.toHaveProperty('stack');
    });
  });

  // =========================================================================
  // 3. PRODUCTION FRONTEND BUILD & ASSET INTEGRITY
  // =========================================================================
  describe('3. Production Frontend Bundling & Static Assets', () => {
    const publicDir = path.resolve(__dirname, '../public');

    test('all entry HTML shells exist and are valid non-empty files', () => {
      const htmlFiles = ['index.html', 'login.html', 'dashboard.html'];
      for (const file of htmlFiles) {
        const filePath = path.join(publicDir, file);
        expect(fs.existsSync(filePath)).toBe(true);
        const stat = fs.statSync(filePath);
        expect(stat.size).toBeGreaterThan(200); // Must be a real populated shell
      }
    });

    test('static JavaScript and CSS bundles exist with content hashes', () => {
      const staticDir = path.join(publicDir, 'static');
      expect(fs.existsSync(staticDir)).toBe(true);

      const files = fs.readdirSync(staticDir);
      const jsFiles = files.filter(f => f.endsWith('.js'));
      const cssFiles = files.filter(f => f.endsWith('.css'));
      const fontFiles = files.filter(f => f.endsWith('.woff') || f.endsWith('.woff2'));

      expect(jsFiles.length).toBeGreaterThanOrEqual(3); // index, login, dashboard
      expect(cssFiles.length).toBeGreaterThanOrEqual(3);
      expect(fontFiles.length).toBeGreaterThanOrEqual(4); // local Poppins font weights
    });

    test('AUDIT: measures landing page asset weight and flags uncompressed media', () => {
      const assetsDir = path.join(publicDir, 'assets');
      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir);
        let totalAssetBytes = 0;
        for (const f of files) {
          totalAssetBytes += fs.statSync(path.join(assetsDir, f)).size;
        }
        const totalMB = totalAssetBytes / (1024 * 1024);
        // Documents the 22MB asset payload for optimization
        expect(totalMB).toBeGreaterThan(15);
      }
    });
  });

  // =========================================================================
  // 4. SECRETS & ENVIRONMENT HARDENING
  // =========================================================================
  describe('4. Cryptographic Secrets & Environment Hardening', () => {
    test('jwt utility strictly refuses to sign or verify tokens if JWT_SECRET is unset', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      // Re-require jwt module with missing secret
      jest.resetModules();
      const jwtUtil = require('../src/utils/jwt');

      expect(() => {
        jwtUtil.signSessionToken({ _id: '123', email: 'test@bc.ac.za' });
      }).toThrow(/JWT_SECRET is not set/);

      expect(() => {
        jwtUtil.verifySessionToken('dummy.token.payload');
      }).toThrow(/JWT_SECRET is not set/);

      process.env.JWT_SECRET = originalSecret;
    });
  });

  // =========================================================================
  // 5. PACKAGING SETTINGS & COOKED MAPS VERIFICATION
  // =========================================================================
  describe('5. Unreal Engine Packaging Release Configuration', () => {
    test('DefaultGame.ini contains all 9 required sub-levels and persistent maps in +MapsToCook', () => {
      const configPath = path.resolve(__dirname, '../../Config/DefaultGame.ini');
      expect(fs.existsSync(configPath)).toBe(true);

      const content = fs.readFileSync(configPath, 'utf8');

      const requiredMaps = [
        'LVL_Persistent',
        'LVL_Library',
        'LVL_TechnoLab',
        'LVL_OuterCampus',
        'LVL_Cafeteria',
        'LVL_Hallway',
        'LVL_Alpha',
        'LVL_Auditorium',
        'LVL_Sigma',
      ];

      for (const mapName of requiredMaps) {
        expect(content).toContain(`+MapsToCook=(FilePath="/Game/Levels/Stellenbosch/${mapName}")`);
      }
    });
  });
});
