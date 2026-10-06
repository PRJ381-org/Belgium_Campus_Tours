const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

let mongod;
let app;
let User;
let Lead;
let AnalyticsEvent;
let adminToken;
let viewerToken;
let mongoUri;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'extended-resilience-secret-key-381';

  mongod = await MongoMemoryServer.create();
  mongoUri = mongod.getUri();
  await mongoose.connect(mongoUri);

  User = require('../src/models/User');
  Lead = require('../src/models/Lead');
  AnalyticsEvent = require('../src/models/AnalyticsEvent');

  const adminUser = await User.create({
    name: 'Admin ResilienceTester',
    email: 'admin.resilience@belgiumcampus.ac.za',
    password: 'Password123!',
    role: 'admin',
  });

  const viewerUser = await User.create({
    name: 'Viewer Tester',
    email: 'viewer.resilience@belgiumcampus.ac.za',
    password: 'Password123!',
    role: 'viewer',
  });

  adminToken = jwt.sign(
    { id: adminUser._id, email: adminUser.email, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  viewerToken = jwt.sign(
    { id: viewerUser._id, email: viewerUser.email, role: 'viewer' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  app = require('../src/app');
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) await mongod.stop();
});

describe('Extended Project Resilience & Off-Ticket Edge Testing', () => {
  // =========================================================================
  // 1. DATABASE OUTAGE, CIRCUIT BREAKER & FAULT TOLERANCE
  // =========================================================================
  describe('1. Database Outage & Degraded-State Circuit Breaker', () => {
    test('verifies graceful degraded state when MongoDB disconnects', async () => {
      // Intentionally simulate a database server crash/disconnect
      await mongoose.disconnect();
      expect(mongoose.connection.readyState).toBe(0); // disconnected

      // 1. /health reports db: 'disconnected' but HTTP status remains 200
      const healthRes = await request(app).get('/health');
      expect(healthRes.status).toBe(200);
      expect(healthRes.body.status).toBe('ok');
      expect(healthRes.body.db).toBe('disconnected');
      expect(healthRes.body.dbState).toBe(0);

      // 2. /api/status does not crash; returns degraded telemetry snapshot null
      const statusRes = await request(app)
        .get('/api/status')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.database.state).toBe('disconnected');
      expect(statusRes.body.telemetry).toBeNull();
      expect(statusRes.body.activity).toBeNull();

      // 3. /api/auth/me verifies session token without DB dependency
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.user.role).toBe('admin');

      // 4. requireDb middleware intercepts DB-dependent writes with 503 and Retry-After
      const leadRes = await request(app)
        .post('/api/leads')
        .send({ email: 'student.outage@belgiumcampus.ac.za' });
      expect(leadRes.status).toBe(503);
      expect(leadRes.headers['retry-after']).toBe('30');
      expect(leadRes.body.success).toBe(false);
      expect(leadRes.body.message).toMatch(/Database unavailable/i);

      // 5. Unauthenticated callers get 401, preserving security precedence
      const unauthExport = await request(app).get('/api/export/summary');
      expect(unauthExport.status).toBe(401);

      // Reconnect database to restore normal state
      await mongoose.connect(mongoUri);
      expect(mongoose.connection.readyState).toBe(1); // connected

      // Verify immediate self-healing after reconnect
      const restoredHealth = await request(app).get('/health');
      expect(restoredHealth.status).toBe(200);
      expect(restoredHealth.body.db).toBe('connected');
    });
  });

  // =========================================================================
  // 2. EXECUTIVE ANALYTICS KPI & MATHEMATICAL INTEGRITY
  // =========================================================================
  describe('2. Executive Analytics KPI & Mathematical Integrity', () => {
    beforeEach(async () => {
      await Lead.deleteMany({});
      await AnalyticsEvent.deleteMany({});
    });

    test('handles zero-data state cleanly without NaN or division by zero', async () => {
      const res = await request(app)
        .get('/api/export/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Unique VR Sessions,0,');
      expect(res.text).toContain('Total Analytics Events,0,');
      expect(res.text).toContain('Total Student Leads,0,');
      expect(res.text).toContain('Conversion Rate,0.0%,');
      expect(res.text).toContain('Avg Session Duration,0m 0s,');
      expect(res.text).not.toContain('NaN');
    });

    test('accurately calculates conversion rate, dwell time and top hotspots', async () => {
      // Seed 2 distinct visitor sessions
      const session1 = 'session-resilience-alpha';
      const session2 = 'session-resilience-beta';

      // Session 1: 60s in Library, visits hotspot 'hs_books'
      await AnalyticsEvent.create({
        sessionId: session1,
        eventType: 'area_exit',
        area: 'Library',
        hotspotId: 'hs_books',
        durationMs: 60000,
        platform: 'quest',
      });

      // Session 2: 120s in TechnoLab, visits hotspot 'hs_robot'
      await AnalyticsEvent.create({
        sessionId: session2,
        eventType: 'area_exit',
        area: 'TechnoLab',
        hotspotId: 'hs_robot',
        durationMs: 120000,
        platform: 'windows',
      });

      // 1 lead converted out of 2 unique sessions -> Conversion rate 50.0%
      await Lead.create({
        email: 'prospective.student@bc.ac.za',
        sessionId: session1,
        source: 'hotspot:hs_books',
      });

      const res = await request(app)
        .get('/api/export/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.text).toContain('Unique VR Sessions,2,');
      expect(res.text).toContain('Total Analytics Events,2,');
      expect(res.text).toContain('Total Student Leads,1,');
      expect(res.text).toContain('Conversion Rate,50.0%,');
      // Average session duration: (60s + 120s) / 2 = 90s = 1m 30s
      expect(res.text).toContain('Avg Session Duration,1m 30s,');
      // Area dwell ranking
      expect(res.text).toContain('"TechnoLab",120,1');
      expect(res.text).toContain('"Library",60,1');
      // Hotspots
      expect(res.text).toContain('"hs_robot",1');
      expect(res.text).toContain('"hs_books",1');
    });
  });

  // =========================================================================
  // 3. BUILD DISTRIBUTION, PATH TRAVERSAL & STREAMING DEFENSE
  // =========================================================================
  describe('3. Build Distribution & Directory Traversal Defense', () => {
    test('strictly validates platform parameter and rejects path traversal', async () => {
      const invalidPlatforms = ['windows.exe', 'linux', 'ios', 'mac', 'android_apk'];
      for (const platform of invalidPlatforms) {
        const res = await request(app).get(`/api/download/${platform}`);
        expect(res.status).toBe(400);
        expect(res.text).toMatch(/Invalid platform requested/i);
      }

      const traversalPayloads = ['..%2f..%2fpackage.json', '../../package.json', 'etc/passwd'];
      for (const payload of traversalPayloads) {
        const res = await request(app).get(`/api/download/${payload}`);
        expect([400, 404]).toContain(res.status);
      }
    });

    test('returns structured 404 when valid build archive is not found on disk', async () => {
      const res = await request(app).get('/api/download/desktop');
      expect(res.status).toBe(404);
      expect(res.text).toMatch(/Build file not found on the server/i);
    });

    test('serves public download build metadata contract via /api/downloads/info', async () => {
      const res = await request(app).get('/api/downloads/info');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.version).toBeDefined();
      expect(res.body.platforms).toHaveProperty('windows');
      expect(res.body.platforms).toHaveProperty('android');
      expect(res.body.platforms).toHaveProperty('quest');
    });
  });

  // =========================================================================
  // 4. DATABASE MIGRATION SCRIPT & DATA DERIVATION PURITY
  // =========================================================================
  describe('4. Database Migration Script & Source Derivation Purity', () => {
    test('Lead.deriveSource handles explicit, hotspot-sourced, and fallback scenarios', () => {
      // 1. Explicit source takes precedence
      expect(Lead.deriveSource({ source: 'open_day_qr', hotspotId: 'kiosk_1' })).toBe('open_day_qr');

      // 2. Hotspot-sourced leads are namespaced with "hotspot:<id>"
      expect(Lead.deriveSource({ hotspotId: 'techno_kiosk' })).toBe('hotspot:techno_kiosk');

      // 3. Whitespace trimming in hotspotId
      expect(Lead.deriveSource({ hotspotId: '  library_desk  ' })).toBe('hotspot:library_desk');

      // 4. Fallback defaults to DEFAULT_LEAD_SOURCE ('end_screen')
      expect(Lead.deriveSource({})).toBe('end_screen');
      expect(Lead.deriveSource({ source: '', hotspotId: '' })).toBe('end_screen');
      expect(Lead.deriveSource()).toBe('end_screen');
    });
  });
});
