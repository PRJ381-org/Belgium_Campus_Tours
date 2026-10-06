const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

let mongod;
let app;
let User;
let Lead;
let Feedback;
let Ticket;
let adminToken;
let viewerToken;
let masterUser;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'chaos-adversarial-secret-key-381';

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  User = require('../src/models/User');
  Lead = require('../src/models/Lead');
  Feedback = require('../src/models/Feedback');
  Ticket = require('../src/models/Ticket');

  // Seed standard accounts
  masterUser = await User.create({
    name: 'Master Account',
    email: 'admin@belgiumcampus.ac.za',
    password: 'MasterPassword123!',
    role: 'master',
  });

  const viewerUser = await User.create({
    name: 'Viewer Staff',
    email: 'viewer.chaos@belgiumcampus.ac.za',
    password: 'ViewerPassword123!',
    role: 'viewer',
  });

  adminToken = jwt.sign(
    { id: masterUser._id, email: masterUser.email, role: 'master' },
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
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('Intense Website Chaos, Limits & Adversarial Penetration Testing', () => {
  beforeEach(async () => {
    await Lead.deleteMany({});
    await Feedback.deleteMany({});
    await Ticket.deleteMany({});
  });

  // =========================================================================
  // 1. ADVERSARIAL NOSQL INJECTION ATTEMPTS
  // =========================================================================
  describe('1. Adversarial NoSQL Query Injection Defense', () => {
    test('POST /api/auth/login rejects NoSQL operator injection in credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: { $gt: '' },
          password: { $ne: null },
        });

      // Must be rejected by express-validator with 400 before reaching database query
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('POST /api/tickets/lookup rejects regex and NoSQL probe operators', async () => {
      const res = await request(app)
        .post('/api/tickets/lookup')
        .send({
          ref: { $regex: '.*' },
          email: { $ne: '' },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('POST /api/leads rejects array or object injection in email field', async () => {
      const res = await request(app)
        .post('/api/leads')
        .send({
          email: ['hacker1@bc.ac.za', 'hacker2@bc.ac.za'],
          hotspotId: 'hs_math',
        });

      expect([400, 500]).toContain(res.status);
    });
  });

  // =========================================================================
  // 2. PAYLOAD DOS & EXTREME BOUNDARY TESTING
  // =========================================================================
  describe('2. Payload DoS & Excessive Size Limits', () => {
    test('rejects payload exceeding 100kb with HTTP 413 Payload Too Large', async () => {
      const giganticText = 'Z'.repeat(105 * 1024); // 105 KB
      const res = await request(app)
        .post('/api/feedback')
        .send({
          name: 'DoS Attacker',
          email: 'dos@attacker.com',
          rating: 5,
          liked: giganticText,
        });

      expect(res.status).toBe(413);
    });

    test('handles deeply nested JSON objects without crashing process', async () => {
      let nested = { value: 'leaf' };
      for (let i = 0; i < 40; i++) {
        nested = { child: nested };
      }

      const res = await request(app)
        .post('/api/feedback')
        .send({
          name: 'Nesting Tester',
          email: 'nested@test.com',
          rating: 5,
          liked: 'Valid text',
          metadata: nested,
        });

      // Accepts or validates cleanly without uncaught recursive call stack overflow
      expect([201, 400]).toContain(res.status);
    });
  });

  // =========================================================================
  // 3. XSS & SCRIPT INJECTION RESILIENCE
  // =========================================================================
  describe('3. XSS Payloads & Content Sanitization', () => {
    test('stores HTML and Script tags literally without server-side execution', async () => {
      const xssPayload = "<script>alert('XSS')</script><img src=x onerror=alert(1)>";
      const res = await request(app)
        .post('/api/feedback')
        .send({
          name: '<script>evil()</script>',
          email: 'xss.visitor@belgiumcampus.ac.za',
          rating: 4,
          liked: xssPayload,
          improve: '<svg/onload=fetch("http://evil.com")>',
        });

      expect(res.status).toBe(201);
      const stored = await Feedback.findOne({ email: 'xss.visitor@belgiumcampus.ac.za' });
      expect(stored.liked).toBe(xssPayload);

      // Verify that CSV export defuses it safely
      const exportRes = await request(app)
        .get('/api/export/feedback')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(exportRes.status).toBe(200);
      expect(exportRes.text).toContain(xssPayload);
    });
  });

  // =========================================================================
  // 4. MALFORMED & FRACTIONAL RATING FUZZING
  // =========================================================================
  describe('4. Input Fuzzing & Value Boundary Limits', () => {
    test('rejects non-integer ratings, fractional numbers and out-of-range ratings', async () => {
      const invalidRatings = [0, 6, -1, 3.5, 4.99, NaN, Infinity, -Infinity, null, 'abc'];

      for (const r of invalidRatings) {
        const res = await request(app)
          .post('/api/feedback')
          .send({
            name: 'Rating Fuzzer',
            email: 'fuzzer@bc.ac.za',
            rating: r,
          });

        expect(res.status).toBe(400);
      }
    });

    test('coerces string integer ratings cleanly into integer numbers', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .send({
          name: 'String Rating Visitor',
          email: 'string.rating@bc.ac.za',
          rating: '5',
        });

      expect(res.status).toBe(201);
      const stored = await Feedback.findOne({ email: 'string.rating@bc.ac.za' });
      expect(stored.rating).toBe(5);
    });

    test('rejects feedback with liked or improve exceeding 1000 characters', async () => {
      const longText1001 = 'A'.repeat(1001);
      const res = await request(app)
        .post('/api/feedback')
        .send({
          name: 'Long Text Tester',
          email: 'long@bc.ac.za',
          rating: 5,
          liked: longText1001,
        });

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // 5. AVATAR EXPLOIT VECTORS & PAYLOAD TAMPERING
  // =========================================================================
  describe('5. Profile Avatar Attack Vectors', () => {
    test('rejects SVG vectors containing script tags', async () => {
      const svgPayload = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4=';
      const res = await request(app)
        .put('/api/auth/me/avatar')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ avatar: svgPayload });

      expect(res.status).toBe(400);
      expect(res.body.errors.some(e => e.path === 'avatar')).toBe(true);
    });

    test('rejects non-base64 characters and corrupted data URIs', async () => {
      const corruptedPayloads = [
        'data:image/png;base64,@@@@INVALID$$$$',
        'data:text/html;base64,PGgxPkhhY2tlZDwvaDE+',
        'data:application/javascript;base64,YWxlcnQoMSk=',
        'not-even-a-data-url',
      ];

      for (const payload of corruptedPayloads) {
        const res = await request(app)
          .put('/api/auth/me/avatar')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ avatar: payload });

        expect(res.status).toBe(400);
      }
    });
  });

  // =========================================================================
  // 6. CSV FORMULA INJECTION DEFENSE (DDE VULNERABILITY AUDIT)
  // =========================================================================
  describe('6. CSV Formula Injection Defense Across All Data Types', () => {
    test('defuses Excel formulas starting with = + - @ in Leads CSV', async () => {
      await Lead.create({
        email: 'attacker1@example.com',
        source: '=cmd|\' /C calc\'!A0',
        sessionId: '@testSession',
      });
      await Lead.create({
        email: 'attacker2@example.com',
        source: '+SUM(1+1)*cmd',
        sessionId: '-2+3',
      });

      const res = await request(app)
        .get('/api/export/leads')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      // All formula characters must be prepended with a single quote '
      expect(res.text).toContain("'=cmd");
      expect(res.text).toContain("'+SUM");
      expect(res.text).toContain("'-2+3");
      expect(res.text).toContain("'@testSession");
    });
  });

  // =========================================================================
  // 7. RBAC PRIVILEGE ESCALATION ATTEMPTS
  // =========================================================================
  describe('7. RBAC Privilege Escalation & Master Account Invariance', () => {
    test('prohibits promoting any user to "master" role via API (400)', async () => {
      const targetUser = await User.create({
        name: 'Target Staff',
        email: 'target@belgiumcampus.ac.za',
        role: 'viewer',
      });

      const res = await request(app)
        .patch(`/api/auth/users/${targetUser._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'master' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('prohibits demoting the master administrator account (400)', async () => {
      const res = await request(app)
        .patch(`/api/auth/users/${masterUser._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'viewer' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Master accounts cannot be changed/i);
    });
  });
});
