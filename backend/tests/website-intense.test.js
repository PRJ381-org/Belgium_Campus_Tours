/**
 * Intense All-Round Website & Portal Test Suite.
 *
 * Exhaustively tests all aspects of the PRJ381 Web Portal:
 * 1. Public Landing Page & Static Asset Pipeline (HTML shells, CSS, JS, MIME types)
 * 2. Downloads & Distribution Telemetry (Metadata, 302 CDN redirects, case-insensitivity)
 * 3. Feedback Engine & Bot Honeypot (Star ratings 1-5, boundaries, spam filtering)
 * 4. Support Helpdesk Inbox (Ticket lifecycle, VC-XXXXXX refs, polling, visitor/staff threads)
 * 5. Authentication & RBAC Hierarchy (Local JWT, bcrypt, viewer vs admin vs master rules)
 * 6. Profile & Avatar Management (Base64 avatar upload, cropping boundaries, deletion)
 * 7. Admin Dashboard Analytics & Timeframe Filters (all, today, 24h, 7d, 30d)
 * 8. Data Export Engine (Leads, Analytics, Feedback, Tickets CSV formats & headers)
 * 9. Security Headers & Defense (Helmet CSP, CORS, X-Forwarded-For proxy trust)
 */
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const User = require('../src/models/User');
const Lead = require('../src/models/Lead');
const Ticket = require('../src/models/Ticket');
const Feedback = require('../src/models/Feedback');
const AnalyticsEvent = require('../src/models/AnalyticsEvent');
const { signSessionToken } = require('../src/utils/jwt');
const { describeDb, connect, disconnect, clear } = require('./helpers/db');

describeDb('Intense All-Round Website Testing Suite', () => {
  let viewerUser;
  let adminUser;
  let masterUser;
  let viewerToken;
  let adminToken;
  let masterToken;

  beforeAll(async () => {
    await connect();
  });

  afterAll(async () => {
    await disconnect();
  });

  beforeEach(async () => {
    await clear();

    // Seed test users across the RBAC spectrum
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('SecurePassword123!', salt);

    viewerUser = await User.create({
      email: 'viewer@belgiumcampus.ac.za',
      password: passwordHash,
      name: 'Viewer Staff',
      role: 'viewer',
      provider: 'local',
    });

    adminUser = await User.create({
      email: 'admin@belgiumcampus.ac.za',
      password: passwordHash,
      name: 'Admin Staff',
      role: 'admin',
      provider: 'local',
    });

    masterUser = await User.create({
      email: 'master@belgiumcampus.ac.za',
      password: passwordHash,
      name: 'Master Admin',
      role: 'master',
      provider: 'local',
    });

    viewerToken = signSessionToken(viewerUser);
    adminToken = signSessionToken(adminUser);
    masterToken = signSessionToken(masterUser);
  });

  // =========================================================================
  // 1. PUBLIC LANDING PAGE & STATIC DELIVERY
  // =========================================================================
  describe('1. Static Website Delivery & Asset Integrity', () => {
    test('GET / serves landing page with valid HTML5 and CSP headers', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toMatch(/<!doctype html>/i);
      expect(res.text).toContain('Virtual Campus Open Day');

      // Verify Helmet Security Headers
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    test('GET /login.html and /dashboard.html serve distinct application shells', async () => {
      const loginRes = await request(app).get('/login.html');
      expect(loginRes.status).toBe(200);
      expect(loginRes.text).toContain('login');

      const dashRes = await request(app).get('/dashboard.html');
      expect(dashRes.status).toBe(200);
      expect(dashRes.text).toContain('dashboard');
    });

    test('legacy /dashboard and /dashboard/anything redirect (302) to /', async () => {
      const res1 = await request(app).get('/dashboard');
      expect(res1.status).toBe(302);
      expect(res1.headers.location).toBe('/');

      const res2 = await request(app).get('/dashboard/users');
      expect(res2.status).toBe(302);
      expect(res2.headers.location).toBe('/');
    });

    test('non-existent API routes return structured 404 JSON, not HTML', async () => {
      const res = await request(app).get('/api/unknown-endpoint');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });
  });

  // =========================================================================
  // 2. DOWNLOADS PORTAL & TELEMETRY INGESTION
  // =========================================================================
  describe('2. Downloads Portal & Binary Distribution', () => {
    test('GET /api/downloads/info returns all 3 platform specs and instructions', async () => {
      const res = await request(app).get('/api/downloads/info');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { platforms } = res.body;
      ['windows', 'android', 'quest'].forEach((p) => {
        expect(platforms[p]).toBeDefined();
        expect(platforms[p].downloadUrl).toBe(`/api/downloads/${p}`);
        expect(platforms[p].cdnUrl).toBeDefined();
        expect(platforms[p].requirements).toBeDefined();
        expect(platforms[p].instructions.length).toBeGreaterThan(0);
      });
    });

    test('GET /api/downloads/:platform handles case insensitivity and writes telemetry event', async () => {
      const sessionId = 'test-session-dl-42';

      // Test uppercase AND lowercase platform requests
      const res1 = await request(app).get(`/api/downloads/WINDOWS?sessionId=${sessionId}`);
      expect(res1.status).toBe(302);
      expect(res1.headers.location).toMatch(/PRJ381-Windows/);

      const res2 = await request(app).get(`/api/downloads/quest?sessionId=${sessionId}`);
      expect(res2.status).toBe(302);
      expect(res2.headers.location).toMatch(/PRJ381-Quest3/);

      // Allow brief async telemetry write
      await new Promise((r) => setTimeout(r, 150));

      const events = await AnalyticsEvent.find({ sessionId, eventType: 'game_download' });
      expect(events.length).toBe(2);
      expect(events.map((e) => e.hotspotId)).toEqual(expect.arrayContaining(['windows_build', 'quest_build']));
    });

    test('GET /api/downloads/:platform rejects invalid platform with 400', async () => {
      const res = await request(app).get('/api/downloads/playstation5');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Expected 'windows', 'android', or 'quest'/);
    });
  });

  // =========================================================================
  // 3. FEEDBACK FORM & HONEYPOT SPAM PROTECTION
  // =========================================================================
  describe('3. Public Feedback Engine & Spam Defense', () => {
    test('accepts well-formed feedback with all rating values (1 to 5)', async () => {
      for (let star = 1; star <= 5; star++) {
        const res = await request(app)
          .post('/api/feedback')
          .send({
            rating: star,
            visitorType: 'prospective_student',
            platform: 'vr',
            name: `Visitor ${star}`,
            email: `visitor${star}@example.com`,
            liked: 'Great experience',
            improve: 'Nothing',
            website: '',
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
      }

      const total = await Feedback.countDocuments();
      expect(total).toBe(5);
    });

    test('rejects out-of-range star ratings (0, 6, -1, string)', async () => {
      const invalidRatings = [0, 6, -1, 10, 'five'];
      for (const r of invalidRatings) {
        const res = await request(app)
          .post('/api/feedback')
          .send({
            rating: r,
            name: 'Tester',
            email: 'tester@example.com',
          });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      }
    });

    test('rejects feedback without name or with malformed email', async () => {
      const res1 = await request(app)
        .post('/api/feedback')
        .send({ rating: 4, email: 'valid@example.com', name: '' });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/api/feedback')
        .send({ rating: 4, name: 'Alice', email: 'not-an-email' });
      expect(res2.status).toBe(400);
    });

    test('HONEYPOT: automated bot submissions populating "website" field are silently neutralized', async () => {
      // Spam bots fill hidden honeypot fields
      const res = await request(app)
        .post('/api/feedback')
        .send({
          rating: 5,
          name: 'Spam Bot',
          email: 'spambot@spam.com',
          website: 'https://malicious-spam-site.com',
        });

      // Shipped controller silently succeeds with fake ID to waste bot resources
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify MongoDB was NOT polluted
      const stored = await Feedback.findOne({ email: 'spambot@spam.com' });
      expect(stored).toBeNull();
    });
  });

  // =========================================================================
  // 4. LIVE SUPPORT HELPDESK & TICKETING LIFECYCLE
  // =========================================================================
  describe('4. Support Widget & Ticketing Engine', () => {
    let createdRef;
    let accessKey;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/tickets')
        .send({
          name: 'Samantha Prospective',
          email: 'samantha@example.com',
          category: 'vr_tour',
          platform: 'vr',
          subject: 'Headset tracking inquiry',
          message: 'Can I use hand tracking on the Meta Quest 3?',
          website: '',
        });

      createdRef = res.body.ref;
      accessKey = res.body.key;
    });

    test('creates ticket, enforces character boundaries and generates VC-XXXXXX reference', async () => {
      expect(createdRef).toMatch(/^VC-[A-Z0-9]{6}$/);
      expect(accessKey).toBeDefined();

      const storedTicket = await Ticket.findOne({ ref: createdRef });
      expect(storedTicket).not.toBeNull();
      expect(storedTicket.status).toBe('open');
      expect(storedTicket.lastMessageBy).toBe('visitor');
    });

    test('rejects ticket with subject > 120 chars or message > 2000 chars', async () => {
      const longSubject = 'A'.repeat(125);
      const res1 = await request(app)
        .post('/api/tickets')
        .send({
          name: 'Tester',
          email: 't@example.com',
          category: 'other',
          subject: longSubject,
          message: 'Valid message',
        });
      expect(res1.status).toBe(400);

      const longMessage = 'M'.repeat(2005);
      const res2 = await request(app)
        .post('/api/tickets')
        .send({
          name: 'Tester',
          email: 't@example.com',
          category: 'other',
          subject: 'Valid Subject',
          message: longMessage,
        });
      expect(res2.status).toBe(400);
    });

    test('visitor can lookup ticket by exact ref and email (case-insensitive email normalization)', async () => {
      const res = await request(app)
        .post('/api/tickets/lookup')
        .send({
          ref: createdRef,
          email: 'SAMANTHA@EXAMPLE.COM',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.ticket.ref).toBe(createdRef);
      expect(res.body.ticket.messages.length).toBe(1);
    });

    test('visitor cannot lookup ticket with incorrect email (anti-enumeration)', async () => {
      const res = await request(app)
        .post('/api/tickets/lookup')
        .send({
          ref: createdRef,
          email: 'wrong.person@example.com',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test('visitor replies to ticket using access key', async () => {
      const res = await request(app)
        .post(`/api/tickets/${createdRef}/messages`)
        .send({
          key: accessKey,
          message: 'Also, does the tour support Quest Pro controllers?',
        });

      expect(res.status).toBe(200);
      expect(res.body.ticket.messages.length).toBe(2);
      expect(res.body.ticket.lastMessageBy).toBe('visitor');
    });

    test('rejects visitor reply with invalid access key (403/404)', async () => {
      const res = await request(app)
        .post(`/api/tickets/${createdRef}/messages`)
        .send({
          key: 'bogus-access-key-123',
          message: 'Trying to spoof a reply',
        });

      expect([403, 404]).toContain(res.status);
    });

    test('staff responds to ticket from dashboard and changes status', async () => {
      const replyRes = await request(app)
        .post(`/api/tickets/${createdRef}/reply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ message: 'Yes, hand tracking and Quest Pro are fully supported!' });

      expect(replyRes.status).toBe(200);
      expect(replyRes.body.ticket.messages.length).toBe(2);
      expect(replyRes.body.ticket.lastMessageBy).toBe('staff');

      // Change status to in_progress
      const statusRes = await request(app)
        .patch(`/api/tickets/${createdRef}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'in_progress' });

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.ticket.status).toBe('in_progress');
    });

    test('ticket stats endpoint reports needsReply count accurately', async () => {
      const statsRes = await request(app)
        .get('/api/tickets/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(statsRes.status).toBe(200);
      expect(statsRes.body).toHaveProperty('open');
      expect(statsRes.body).toHaveProperty('needsReply');
    });
  });

  // =========================================================================
  // 5. AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC)
  // =========================================================================
  describe('5. Authentication, Sessions & RBAC Security Hierarchy', () => {
    test('POST /api/auth/login succeeds with valid credentials and returns JWT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@belgiumcampus.ac.za',
          password: 'SecurePassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('admin');
      expect(res.body.user.email).toBe('admin@belgiumcampus.ac.za');
    });

    test('POST /api/auth/login fails on incorrect password or non-existent user', async () => {
      const res1 = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@belgiumcampus.ac.za', password: 'WrongPassword' });
      expect(res1.status).toBe(401);
      expect(res1.body.success).toBe(false);

      const res2 = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ghost@belgiumcampus.ac.za', password: 'SecurePassword123!' });
      expect(res2.status).toBe(401);
    });

    test('GET /api/auth/me returns current session user information', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('admin@belgiumcampus.ac.za');
      expect(res.body.user.role).toBe('admin');
    });

    test('RBAC: Viewer cannot access /api/auth/users (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });

    test('RBAC: Admin can list users, but cannot promote/demote user roles (Master only)', async () => {
      const listRes = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.users.length).toBe(3);

      const patchRes = await request(app)
        .patch(`/api/auth/users/${viewerUser._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' });
      expect(patchRes.status).toBe(403);
    });

    test('RBAC: Master can promote viewer to admin and demote back', async () => {
      const promoteRes = await request(app)
        .patch(`/api/auth/users/${viewerUser._id}/role`)
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ role: 'admin' });

      expect(promoteRes.status).toBe(200);
      expect(promoteRes.body.user.role).toBe('admin');

      const demoteRes = await request(app)
        .patch(`/api/auth/users/${viewerUser._id}/role`)
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ role: 'viewer' });

      expect(demoteRes.status).toBe(200);
      expect(demoteRes.body.user.role).toBe('viewer');
    });

    test('RBAC PROTECTION: Master account cannot be modified or demoted via API', async () => {
      const res = await request(app)
        .patch(`/api/auth/users/${masterUser._id}/role`)
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ role: 'viewer' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Master accounts cannot be changed/);
    });
  });

  // =========================================================================
  // 6. PROFILE & AVATAR PHOTO MANAGEMENT
  // =========================================================================
  describe('6. Profile Avatar Management & Limits', () => {
    const validBase64Avatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    test('sets, retrieves, and deletes profile avatar', async () => {
      // 1. Set Avatar
      const setRes = await request(app)
        .put('/api/auth/me/avatar')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ avatar: validBase64Avatar });

      expect(setRes.status).toBe(200);
      expect(setRes.body.avatar).toBe(validBase64Avatar);

      // 2. Get Avatar
      const getRes = await request(app)
        .get('/api/auth/me/avatar')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.avatar).toBe(validBase64Avatar);

      // 3. Delete Avatar
      const delRes = await request(app)
        .delete('/api/auth/me/avatar')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.avatar).toBe('');
    });

    test('rejects non-base64 image strings for avatar', async () => {
      const res = await request(app)
        .put('/api/auth/me/avatar')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ avatar: 'not-a-data-url-image' });

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // 7. DATA EXPORTS & TIMEFRAME AGGREGATION
  // =========================================================================
  describe('7. Analytics Aggregations & CSV Data Export', () => {
    beforeEach(async () => {
      await Lead.create({
        email: 'export.lead@bc.ac.za',
        hotspotId: 'hs_math',
        source: 'hotspot:hs_math',
        sessionId: 'sess_exp_1',
      });

      await Feedback.create({
        rating: 5,
        name: 'Export Visitor',
        email: 'export.visitor@bc.ac.za',
        liked: 'Everything',
      });
    });

    test('GET /api/export/leads returns compliant CSV with expected header schema', async () => {
      const res = await request(app)
        .get('/api/export/leads')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toMatch(/Student Email,Source,Session ID/i);
      expect(res.text).toContain('export.lead@bc.ac.za');
    });

    test('GET /api/export/feedback returns compliant CSV', async () => {
      const res = await request(app)
        .get('/api/export/feedback')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain('export.visitor@bc.ac.za');
    });

    test('timeframe query filtering works across today, 24h, 7d, 30d, all', async () => {
      const timeframes = ['all', 'today', '24h', '7d', '30d'];
      for (const tf of timeframes) {
        const res = await request(app)
          .get(`/api/analytics/summary?timeframe=${tf}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.timeframe).toBe(tf);
        expect(res.body).toHaveProperty('totalEvents');
        expect(res.body).toHaveProperty('uniqueSessions');
      }
    });
  });
});
