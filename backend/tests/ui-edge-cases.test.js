const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

let mongod;
let app;
let Lead;
let Feedback;
let Ticket;
let User;
let adminToken;
let viewerToken;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'ui-edge-test-jwt-secret-key-381';

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  Lead = require('../src/models/Lead');
  Feedback = require('../src/models/Feedback');
  Ticket = require('../src/models/Ticket');
  User = require('../src/models/User');

  // Seed test users
  const adminUser = await User.create({
    name: 'Admin Tester',
    email: 'admin.edge@belgiumcampus.ac.za',
    password: 'EdgePassword123!',
    role: 'admin',
  });

  const viewerUser = await User.create({
    name: 'Viewer Tester',
    email: 'viewer.edge@belgiumcampus.ac.za',
    password: 'ViewerPassword123!',
    role: 'viewer',
  });

  adminToken = jwt.sign(
    { id: adminUser._id, email: adminUser.email, role: adminUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  viewerToken = jwt.sign(
    { id: viewerUser._id, email: viewerUser.email, role: viewerUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  app = require('../src/app');
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('Ticket 4: UI Limitations, Character Boundaries & Input Edge Cases', () => {
  beforeEach(async () => {
    await Lead.deleteMany({});
    await Feedback.deleteMany({});
    await Ticket.deleteMany({});
  });

  // =========================================================================
  // 1. EXACT CHARACTER BOUNDARY TESTS (Tolerances & Overflow)
  // =========================================================================
  describe('1. Exact Character Boundary Validations', () => {
    test('Ticket Subject: accepts exact 120-char boundary, rejects 121 chars', async () => {
      const exact120 = 'A'.repeat(120);
      const resValid = await request(app)
        .post('/api/tickets')
        .send({
          name: 'Boundary Tester',
          email: 'boundary@example.com',
          category: 'vr_tour',
          subject: exact120,
          message: 'Boundary message',
        });
      expect(resValid.status).toBe(201);
      expect(resValid.body.ref).toMatch(/^VC-/);

      const overflow121 = 'A'.repeat(121);
      const resInvalid = await request(app)
        .post('/api/tickets')
        .send({
          name: 'Boundary Tester',
          email: 'boundary@example.com',
          category: 'vr_tour',
          subject: overflow121,
          message: 'Boundary message',
        });
      expect(resInvalid.status).toBe(400);
      expect(resInvalid.body.errors.some(e => e.path === 'subject')).toBe(true);
    });

    test('Ticket Message: accepts exact 2000-char boundary, rejects 2001 chars', async () => {
      const exact2000 = 'M'.repeat(2000);
      const resValid = await request(app)
        .post('/api/tickets')
        .send({
          name: 'Boundary Tester',
          email: 'boundary@example.com',
          category: 'vr_tour',
          subject: 'Valid Subject',
          message: exact2000,
        });
      expect(resValid.status).toBe(201);

      const overflow2001 = 'M'.repeat(2001);
      const resInvalid = await request(app)
        .post('/api/tickets')
        .send({
          name: 'Boundary Tester',
          email: 'boundary@example.com',
          category: 'vr_tour',
          subject: 'Valid Subject',
          message: overflow2001,
        });
      expect(resInvalid.status).toBe(400);
      expect(resInvalid.body.errors.some(e => e.path === 'message')).toBe(true);
    });

    test('Feedback Name: accepts exact 100-char boundary, rejects 101 chars', async () => {
      const exact100 = 'N'.repeat(100);
      const resValid = await request(app)
        .post('/api/feedback')
        .send({
          name: exact100,
          email: 'feedback.boundary@example.com',
          rating: 5,
        });
      expect(resValid.status).toBe(201);

      const overflow101 = 'N'.repeat(101);
      const resInvalid = await request(app)
        .post('/api/feedback')
        .send({
          name: overflow101,
          email: 'feedback.boundary@example.com',
          rating: 5,
        });
      expect(resInvalid.status).toBe(400);
    });
  });

  // =========================================================================
  // 2. MULTI-BYTE UTF-8 UNICODE, EMOJI & SPECIAL CHARACTER SANITIZATION
  // =========================================================================
  describe('2. International Unicode & Multi-Byte Emoji Safety', () => {
    test('handles multi-byte 4-byte Emojis in feedback text without byte truncation', async () => {
      const emojiString = 'Loved the tour! 🎓🏫🚀✨🔥 Awesome graphics and interactions!';
      const res = await request(app)
        .post('/api/feedback')
        .send({
          name: 'Alex Visitor 🎉',
          email: 'alex.emoji@bc.ac.za',
          rating: 5,
          liked: emojiString,
          improve: 'Add more MetaHumans! 🤖👋',
        });

      expect(res.status).toBe(201);
      const stored = await Feedback.findOne({ email: 'alex.emoji@bc.ac.za' });
      expect(stored).not.toBeNull();
      expect(stored.name).toBe('Alex Visitor 🎉');
      expect(stored.liked).toBe(emojiString);
    });

    test('handles international multilingual scripts (CJK, Arabic, Cyrillic, Diacritics)', async () => {
      const multiLingualData = {
        name: 'François Müller 李小龙',
        email: 'francois.mueller@example.com',
        category: 'other',
        subject: 'VR Campus Tour: مرحبا بالعالم - こんにちは',
        message: 'Спасибо за отличную экскурсию! Sehr gut gemacht.',
      };

      const res = await request(app)
        .post('/api/tickets')
        .send(multiLingualData);

      expect(res.status).toBe(201);
      const ticket = await Ticket.findOne({ ref: res.body.ref });
      expect(ticket.name).toBe(multiLingualData.name);
      expect(ticket.subject).toBe(multiLingualData.subject);
      expect(ticket.messages[0].body).toBe(multiLingualData.message);
    });

    test('handles leading and trailing whitespace in text fields by trimming', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .send({
          name: '   Padded Visitor   ',
          email: 'padded.visitor@belgiumcampus.ac.za',
          category: 'vr_tour',
          subject: '   Whitespace Inquiry   ',
          message: '   This is a padded message with leading and trailing spaces.   ',
        });

      expect(res.status).toBe(201);
      const ticket = await Ticket.findOne({ ref: res.body.ref });
      expect(ticket.name).toBe('Padded Visitor');
      expect(ticket.subject).toBe('Whitespace Inquiry');
      expect(ticket.messages[0].body).toBe('This is a padded message with leading and trailing spaces.');
    });

    test('EDGE CASE: untrimmed email containing whitespace fails isEmail validation (400)', async () => {
      const res = await request(app)
        .post('/api/leads')
        .send({
          email: 'padded.student@belgiumcampus.ac.za \n',
          hotspotId: 'hs_library',
        });

      expect(res.status).toBe(400);
      expect(res.body.errors.some(e => e.path === 'email')).toBe(true);
    });
  });

  // =========================================================================
  // 3. EMAIL NORMALIZATION & COMPLIANCE EDGE CASES
  // =========================================================================
  describe('3. Email Normalization & Validation Edge Cases', () => {
    test('sub-addressing: strips plus-tag on Gmail, preserves on custom university domains', async () => {
      // 1. Gmail sub-addressing (canonical root is extracted)
      const resGmail = await request(app)
        .post('/api/leads')
        .send({
          email: 'prospective.student+openDay2026@gmail.com',
          hotspotId: 'hs_techno',
        });

      expect(resGmail.status).toBe(201);
      const gmailLead = await Lead.findOne({ hotspotId: 'hs_techno' });
      expect(gmailLead.email).toBe('prospectivestudent@gmail.com');

      // 2. Belgium Campus domain sub-addressing (retains sub-address)
      const resBc = await request(app)
        .post('/api/leads')
        .send({
          email: 'prospective.student+openDay2026@belgiumcampus.ac.za',
          hotspotId: 'hs_library',
        });

      expect(resBc.status).toBe(201);
      const bcLead = await Lead.findOne({ hotspotId: 'hs_library' });
      expect(bcLead.email).toBe('prospective.student+openday2026@belgiumcampus.ac.za');
    });

    test('case insensitivity in ticket lookup handles all uppercase lookup input', async () => {
      const ticket = await Ticket.create({
        ref: 'VC-TEST99',
        name: 'Case Test',
        email: 'student.case@belgiumcampus.ac.za',
        category: 'vr_tour',
        subject: 'Case test subject',
        messages: [{ author: 'visitor', body: 'Test message' }],
      });

      const res = await request(app)
        .post('/api/tickets/lookup')
        .send({
          ref: 'VC-TEST99',
          email: 'STUDENT.CASE@BELGIUMCAMPUS.AC.ZA',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.ticket.ref).toBe('VC-TEST99');
    });

    test('rejects syntactically invalid emails', async () => {
      const invalidEmails = [
        'plainaddress',
        '@missingusername.com',
        'username@.com',
        'username@domain..com',
        'user space@domain.com',
      ];

      for (const email of invalidEmails) {
        const res = await request(app)
          .post('/api/leads')
          .send({ email });
        expect(res.status).toBe(400);
      }
    });
  });

  // =========================================================================
  // 4. AUTHENTICATION TOKEN TAMPERING & HEADER EDGE CASES
  // =========================================================================
  describe('4. Authentication Edge Cases & Token Tampering', () => {
    test('rejects request with forged/tampered JWT signature (401)', async () => {
      const tamperedToken = jwt.sign(
        { id: 'fake-id', email: 'hacker@malicious.com', role: 'master' },
        'wrong-secret-key-12345'
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('rejects request with expired JWT token (401)', async () => {
      const expiredToken = jwt.sign(
        { id: 'expired-id', email: 'expired@test.com', role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '-10s' } // Expired 10 seconds ago
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('rejects malformed Authorization header formats (401)', async () => {
      const malformedHeaders = [
        'Bearer',
        'Bearer ',
        'Basic dXNlcjpwYXNz',
        'Token some-raw-string',
        'Bearer null',
        'Bearer undefined',
      ];

      for (const header of malformedHeaders) {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', header);
        expect(res.status).toBe(401);
      }
    });
  });

  // =========================================================================
  // 5. DOWNLOAD LINKS & REDIRECT INTEGRITY
  // =========================================================================
  describe('5. Download Links & Redirect Integrity', () => {
    test('handles case-insensitivity on all supported platforms (windows, android, quest)', async () => {
      const testCases = [
        { route: '/api/downloads/WINDOWS', expectedLocation: /zip/ },
        { route: '/api/downloads/Android', expectedLocation: /apk/ },
        { route: '/api/downloads/qUeSt', expectedLocation: /apk/ },
      ];

      for (const tc of testCases) {
        const res = await request(app).get(tc.route);
        expect(res.status).toBe(302);
        expect(res.headers.location).toMatch(tc.expectedLocation);
      }
    });

    test('unknown platform gracefully returns 400 with helpful error hint', async () => {
      const res = await request(app).get('/api/downloads/unknown-os');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Expected 'windows', 'android', or 'quest'/i);
    });
  });
});
