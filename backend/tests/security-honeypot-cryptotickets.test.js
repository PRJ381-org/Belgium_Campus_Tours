const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

let mongod;
let app;
let User;
let Feedback;
let Ticket;
let adminToken;
let viewerToken;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'crypto-tickets-secret-key-381';

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  User = require('../src/models/User');
  Feedback = require('../src/models/Feedback');
  Ticket = require('../src/models/Ticket');

  const adminUser = await User.create({
    name: 'Support Admin',
    email: 'admin.support@belgiumcampus.ac.za',
    password: 'Password123!',
    role: 'admin',
  });

  const viewerUser = await User.create({
    name: 'Viewer Support',
    email: 'viewer.support@belgiumcampus.ac.za',
    password: 'Password123!',
    role: 'viewer',
  });

  adminToken = jwt.sign(
    { id: adminUser._id, email: adminUser.email, name: adminUser.name, role: 'admin' },
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

describe('Security Honeypot & Cryptographic Visitor Tickets', () => {
  beforeEach(async () => {
    await Feedback.deleteMany({});
    await Ticket.deleteMany({});
  });

  // =========================================================================
  // 1. ANTI-BOT HONEYPOT DEFENSE ACROSS VISITOR ENTRYPOINTS
  // =========================================================================
  describe('1. Anti-Bot Honeypot Defense Across Visitor Forms', () => {
    test('silently defuses bot feedback submissions when honeypot is populated', async () => {
      const botPayload = {
        rating: 5,
        name: 'Spam Bot 3000',
        email: 'spambot@promotions.biz',
        liked: 'Buy cheap watches now!',
        website: 'https://spam-phishing-url.com/buy',
      };

      const res = await request(app).post('/api/feedback').send(botPayload);

      // Bot receives 201 Created to pretend it worked
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.id).toBeUndefined();

      // Zero documents stored in database
      const count = await Feedback.countDocuments();
      expect(count).toBe(0);
    });

    test('stores legitimate feedback when honeypot field is empty', async () => {
      const humanPayload = {
        rating: 5,
        name: 'Prospective Student',
        email: 'student@belgiumcampus.ac.za',
        liked: 'The virtual robotics lab was incredible!',
        website: '', // Human browser leaves hidden field empty
      };

      const res = await request(app).post('/api/feedback').send(humanPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.id).toBeDefined();

      const saved = await Feedback.findById(res.body.id);
      expect(saved).not.toBeNull();
      expect(saved.email).toBe('student@belgiumcampus.ac.za');
    });

    test('silently defuses bot support tickets when honeypot is populated', async () => {
      const botPayload = {
        name: 'Ticket Spammer',
        email: 'ticketspammer@seo-blast.org',
        category: 'website',
        subject: 'Boost your campus SEO rankings',
        message: 'Click here for guaranteed rankings',
        website: 'https://seo-spam-link.org',
      };

      const res = await request(app).post('/api/tickets').send(botPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.ref).toBeUndefined();

      const count = await Ticket.countDocuments();
      expect(count).toBe(0);
    });
  });

  // =========================================================================
  // 2. CRYPTOGRAPHIC VISITOR KEY SECURITY & SNOOP ISOLATION
  // =========================================================================
  describe('2. Cryptographic Visitor Key Security & Isolation', () => {
    test('creates ticket with SHA-256 key hash and validates visitor replies with key', async () => {
      // 1. Create a legitimate ticket
      const ticketRes = await request(app).post('/api/tickets').send({
        name: 'Jane Doe',
        email: 'jane.doe@bc.ac.za',
        category: 'vr_tour',
        platform: 'vr',
        subject: 'Headset orientation question',
        message: 'How do I recalibrate the view in the Library?',
        website: '',
      });

      expect(ticketRes.status).toBe(201);
      expect(ticketRes.body.ref).toMatch(/^VC-[A-Z2-9]{6}$/);
      expect(ticketRes.body.key).toBeDefined();
      expect(ticketRes.body.key.length).toBe(48); // 24 bytes hex = 48 chars

      const ref = ticketRes.body.ref;
      const key = ticketRes.body.key;

      // Ensure key is NOT stored in plain text in database
      const dbTicket = await Ticket.findOne({ ref }).select('+keyHashes');
      expect(dbTicket.keyHashes).toHaveLength(1);
      expect(dbTicket.keyHashes[0]).not.toBe(key);
      expect(dbTicket.keyHashes[0]).toBe(Ticket.hashKey(key));

      // 2. Reply with the correct cryptographic key
      const replyRes = await request(app)
        .post(`/api/tickets/${ref}/messages`)
        .send({ key, message: 'I tried pressing the right thumbstick, thanks!' });

      expect(replyRes.status).toBe(200);
      expect(replyRes.body.success).toBe(true);
      expect(replyRes.body.ticket.messages).toHaveLength(2);

      // 3. Attempt reply with forged / attacker key
      const forgedRes = await request(app)
        .post(`/api/tickets/${ref}/messages`)
        .send({ key: '0123456789abcdef0123456789abcdef0123456789abcdef', message: 'Hacker reply' });

      expect(forgedRes.status).toBe(404);
      expect(forgedRes.body.message).toMatch(/not found, or this browser no longer has access/i);
    });

    test('POST /api/tickets/mine filters out any tickets with non-matching keys', async () => {
      const ticketRes = await request(app).post('/api/tickets').send({
        name: 'Alex Visitor',
        email: 'alex@bc.ac.za',
        category: 'download',
        subject: 'Windows build download speed',
        message: 'Download was fast!',
        website: '',
      });

      const { ref, key } = ticketRes.body;

      // Matching key query
      const mineRes = await request(app).post('/api/tickets/mine').send({
        tickets: [{ ref, key }],
      });
      expect(mineRes.status).toBe(200);
      expect(mineRes.body.tickets).toHaveLength(1);
      expect(mineRes.body.tickets[0].ref).toBe(ref);

      // Forged key query
      const spoofMineRes = await request(app).post('/api/tickets/mine').send({
        tickets: [{ ref, key: 'attacker-wrong-key' }],
      });
      expect(spoofMineRes.status).toBe(200);
      expect(spoofMineRes.body.tickets).toHaveLength(0);
    });

    test('recovers ticket on new device via lookup and caps max keys', async () => {
      const ticketRes = await request(app).post('/api/tickets').send({
        name: 'Device Switcher',
        email: 'switcher@bc.ac.za',
        category: 'website',
        subject: 'Account question',
        message: 'First device message',
        website: '',
      });

      const { ref, key: originalKey } = ticketRes.body;

      // Lookup from a second device (ref + email)
      const lookupRes = await request(app).post('/api/tickets/lookup').send({
        ref,
        email: 'switcher@bc.ac.za',
      });

      expect(lookupRes.status).toBe(200);
      expect(lookupRes.body.success).toBe(true);
      expect(lookupRes.body.key).toBeDefined();
      expect(lookupRes.body.key).not.toBe(originalKey);

      const secondKey = lookupRes.body.key;

      // Both original and second keys can reply
      const reply1 = await request(app).post(`/api/tickets/${ref}/messages`).send({
        key: originalKey,
        message: 'Message from device 1',
      });
      expect(reply1.status).toBe(200);

      const reply2 = await request(app).post(`/api/tickets/${ref}/messages`).send({
        key: secondKey,
        message: 'Message from device 2',
      });
      expect(reply2.status).toBe(200);

      // Perform 12 lookups to test Ticket.MAX_KEYS (10) capping
      for (let i = 0; i < 12; i++) {
        await request(app).post('/api/tickets/lookup').send({ ref, email: 'switcher@bc.ac.za' });
      }

      const dbTicket = await Ticket.findOne({ ref }).select('+keyHashes');
      expect(dbTicket.keyHashes.length).toBeLessThanOrEqual(Ticket.MAX_KEYS);
      expect(dbTicket.keyHashes.length).toBe(Ticket.MAX_KEYS);
    });
  });

  // =========================================================================
  // 3. TICKET LIFECYCLE & AUTO-REOPENING
  // =========================================================================
  describe('3. Ticket Lifecycle & Auto-Reopening Invariance', () => {
    test('automatically reopens a resolved ticket when visitor sends a follow-up', async () => {
      const ticketRes = await request(app).post('/api/tickets').send({
        name: 'Follow-up Visitor',
        email: 'followup@bc.ac.za',
        category: 'vr_tour',
        subject: 'VR Controller drift',
        message: 'Left controller is drifting',
        website: '',
      });

      const { ref, key } = ticketRes.body;

      // Staff resolves the ticket
      const resolveRes = await request(app)
        .patch(`/api/tickets/${ref}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'resolved' });

      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.ticket.status).toBe('resolved');

      // Visitor replies back
      const replyRes = await request(app)
        .post(`/api/tickets/${ref}/messages`)
        .send({ key, message: 'Still happening after recalibration!' });

      expect(replyRes.status).toBe(200);
      expect(replyRes.body.ticket.status).toBe('open');

      const checkDb = await Ticket.findOne({ ref });
      expect(checkDb.status).toBe('open');
      expect(checkDb.lastMessageBy).toBe('visitor');
    });
  });

  // =========================================================================
  // 4. STAFF RBAC PRIVILEGE GUARDS
  // =========================================================================
  describe('4. Staff RBAC Protection on Support Dashboard', () => {
    test('prohibits unauthenticated and viewer users from accessing staff ticket routes', async () => {
      // 1. GET /api/tickets (list)
      const anonList = await request(app).get('/api/tickets');
      expect(anonList.status).toBe(401);

      const viewerList = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(viewerList.status).toBe(403);

      const adminList = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminList.status).toBe(200);

      // 2. GET /api/tickets/stats
      const anonStats = await request(app).get('/api/tickets/stats');
      expect(anonStats.status).toBe(401);

      const viewerStats = await request(app)
        .get('/api/tickets/stats')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(viewerStats.status).toBe(403);

      const adminStats = await request(app)
        .get('/api/tickets/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminStats.status).toBe(200);
      expect(adminStats.body).toHaveProperty('open');
      expect(adminStats.body).toHaveProperty('needsReply');
    });
  });
});
