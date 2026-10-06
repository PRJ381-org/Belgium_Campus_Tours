const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

let mongod;
let app;
let User;
let Feedback;
let Ticket;
let Lead;
let adminToken;
let masterUser;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'deep-penetration-secret-381';

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  User = require('../src/models/User');
  Feedback = require('../src/models/Feedback');
  Ticket = require('../src/models/Ticket');
  Lead = require('../src/models/Lead');

  masterUser = await User.create({
    name: 'Master Security Auditor',
    email: 'master.audit@belgiumcampus.ac.za',
    password: 'MasterPassword123!',
    role: 'master',
  });

  adminToken = jwt.sign(
    { id: masterUser._id, email: masterUser.email, role: 'master' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  app = require('../src/app');
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('Deep Penetration & Advanced Web Security Audit', () => {
  beforeEach(async () => {
    await Feedback.deleteMany({});
    await Ticket.deleteMany({});
    await Lead.deleteMany({});
  });

  // =========================================================================
  // 1. PROTOTYPE POLLUTION IMMUNITY
  // =========================================================================
  describe('1. Prototype Pollution & Object Key Tampering', () => {
    test('prohibits polluting global Object prototype via json bodies', async () => {
      expect(({}).polluted).toBeUndefined();
      expect(({}).isAdmin).toBeUndefined();

      const pollutionPayloads = [
        {
          rating: 5,
          name: 'Pollution Tester',
          email: 'pollute@belgiumcampus.ac.za',
          liked: 'Normal feedback',
          __proto__: { polluted: 'compromised', isAdmin: true },
        },
        {
          rating: 4,
          name: 'Constructor Tester',
          email: 'pollute2@belgiumcampus.ac.za',
          constructor: { prototype: { polluted: 'compromised' } },
        },
      ];

      for (const payload of pollutionPayloads) {
        await request(app).post('/api/feedback').send(payload);
      }

      // Verify that Object.prototype remained unpolluted
      expect(({}).polluted).toBeUndefined();
      expect(({}).isAdmin).toBeUndefined();
    });
  });

  // =========================================================================
  // 2. JWT CRYPTOGRAPHIC SIGNATURE TAMPERING & "NONE" ALGORITHM AUDIT
  // =========================================================================
  describe('2. JWT Cryptographic Security & Signature Verification', () => {
    test('rejects unsigned JWT tokens using "none" algorithm attack', async () => {
      // Craft an unverified token with alg: "none"
      const headerB64 = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payloadB64 = Buffer.from(JSON.stringify({ id: masterUser._id, role: 'master', email: masterUser.email })).toString('base64url');
      const noneAlgToken = `${headerB64}.${payloadB64}.`;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${noneAlgToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid or expired token/i);
    });

    test('rejects tokens signed with invalid/foreign secrets', async () => {
      const forgedToken = jwt.sign(
        { id: masterUser._id, role: 'master' },
        'attacker-evil-private-key',
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('rejects expired tokens strictly with HTTP 401', async () => {
      const expiredToken = jwt.sign(
        { id: masterUser._id, role: 'master' },
        process.env.JWT_SECRET,
        { expiresIn: '-10s' } // Expired 10 seconds ago
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('rejects malformed and empty Authorization headers', async () => {
      const malformedHeaders = [
        'Bearer',
        'Bearer ',
        'Bearer not-a-token',
        'Basic dXNlcjpwYXNz',
        'Token 123456',
        'null',
      ];

      for (const header of malformedHeaders) {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', header);

        expect(res.status).toBe(401);
      }
    });

    test('accepts valid token delivered via ?token= query parameter (for export routes)', async () => {
      const res = await request(app)
        .get(`/api/export/summary?token=${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });
  });

  // =========================================================================
  // 3. BLIND INJECTION FUZZING (SQL, COMMAND, TEMPLATE, NULL BYTES, UNICODE)
  // =========================================================================
  describe('3. Blind Injection Payloads & Unicode Fuzzing Immunity', () => {
    test('neutralizes blind SQL, template and shell payloads as inert strings', async () => {
      const fuzzPayloads = [
        "'; DROP TABLE users; --",
        "admin' OR '1'='1",
        "${process.mainModule.require('child_process').execSync('whoami')}",
        "{{7*7}}",
        "<%= 7*7 %>",
        "\u0000admin\u0000",
        "\u202Ereversed_text_exploit\u202C",
        "🚀🤖🔥 Unicode Multibyte Emoji Test",
      ];

      for (const attackStr of fuzzPayloads) {
        const res = await request(app).post('/api/tickets').send({
          name: 'Fuzzer Bot',
          email: 'fuzzer@belgiumcampus.ac.za',
          category: 'website',
          subject: attackStr.slice(0, 100),
          message: attackStr,
          website: '',
        });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);

        // Verify stored text is preserved literally without execution or crashing
        const saved = await Ticket.findOne({ ref: res.body.ref });
        expect(saved.messages[0].body).toBe(attackStr);
      }
    });
  });

  // =========================================================================
  // 4. CONCURRENT RACE CONDITION & TICKET REF CLASH RESILIENCE
  // =========================================================================
  describe('4. High-Concurrency Race Condition & Unique Ref Generation', () => {
    test('handles 30 simultaneous concurrent ticket creations without duplicates or crashes', async () => {
      const promises = [];
      for (let i = 0; i < 30; i++) {
        promises.push(
          request(app)
            .post('/api/tickets')
            .set('X-Forwarded-For', `10.10.1.${i + 1}`)
            .send({
              name: `Concurrent Visitor ${i}`,
              email: `concurrent.${i}@bc.ac.za`,
              category: 'vr_tour',
              subject: `Concurrent Ticket ${i}`,
              message: `Simultaneous submission index ${i}`,
              website: '',
            })
        );
      }

      const results = await Promise.all(promises);

      // Verify all 30 succeeded
      const refs = new Set();
      for (const res of results) {
        expect(res.status).toBe(201);
        expect(res.body.ref).toBeDefined();
        refs.add(res.body.ref);
      }

      // Every ticket ref must be unique
      expect(refs.size).toBe(30);

      const dbCount = await Ticket.countDocuments();
      expect(dbCount).toBe(30);
    });
  });

  // =========================================================================
  // 5. HTTP METHOD TAMPERING & VERB RESTRICTION
  // =========================================================================
  describe('5. HTTP Method Tampering & Verb Restriction', () => {
    test('returns 404/405 for disallowed HTTP methods on API routes', async () => {
      // POST-only routes probed with GET / DELETE
      const getLogin = await request(app).get('/api/auth/login');
      expect([404, 405]).toContain(getLogin.status);

      const deleteLeads = await request(app).delete('/api/leads');
      expect([404, 405]).toContain(deleteLeads.status);

      // PATCH-only role mutation probed with PUT
      const putRole = await request(app)
        .put(`/api/auth/users/${masterUser._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'viewer' });
      expect([404, 405]).toContain(putRole.status);
    });
  });
});
