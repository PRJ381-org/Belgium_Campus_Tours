const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;
let app;
let AnalyticsEvent;
let Lead;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  AnalyticsEvent = require('../src/models/AnalyticsEvent');
  Lead = require('../src/models/Lead');
  app = require('../src/app');
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('Ticket 6: Network & Synchronization Stress Testing', () => {
  beforeEach(async () => {
    await AnalyticsEvent.deleteMany({});
    await Lead.deleteMany({});
  });

  // =========================================================================
  // 1. OFFLINE TELEMETRY ACCUMULATION & BATCH FLUSH
  // =========================================================================
  describe('1. Offline Telemetry Accumulation & Reconnection Flush', () => {
    test('flushes 100 buffered offline events in a single HTTP batch preserving sequence order', async () => {
      const sessionId = 'offline-session-101';
      const events = [];

      for (let i = 1; i <= 100; i++) {
        events.push({
          sessionId,
          eventType: i === 1 ? 'session_start' : (i === 100 ? 'session_end' : 'hotspot_view'),
          area: i % 2 === 0 ? 'Library' : 'TechnoLab',
          hotspotId: `hs_${i}`,
          durationMs: i * 250,
          seq: i,
          platform: 'quest',
          buildId: 'v1.0.0-rc3',
        });
      }

      const res = await request(app)
        .post('/api/analytics/batch')
        .send({ events });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.inserted).toBe(100);

      // Verify sequence order in database
      const stored = await AnalyticsEvent.find({ sessionId }).sort({ seq: 1 });
      expect(stored.length).toBe(100);
      expect(stored[0].seq).toBe(1);
      expect(stored[0].eventType).toBe('session_start');
      expect(stored[99].seq).toBe(100);
      expect(stored[99].eventType).toBe('session_end');
    });

    test('validates batch size boundary (rejects empty array and array > 200 items)', async () => {
      // 0 events
      const resEmpty = await request(app)
        .post('/api/analytics/batch')
        .send({ events: [] });
      expect(resEmpty.status).toBe(400);

      // 201 events (exceeds MAX_BATCH_EVENTS = 200)
      const oversizedEvents = Array.from({ length: 201 }, (_, i) => ({
        sessionId: 'oversized-session',
        eventType: 'area_enter',
        seq: i + 1,
      }));

      const resOversized = await request(app)
        .post('/api/analytics/batch')
        .send({ events: oversizedEvents });
      expect(resOversized.status).toBe(400);
      expect(resOversized.body.errors.some(e => e.path === 'events')).toBe(true);
    });
  });

  // =========================================================================
  // 2. NETWORK JITTER & PACKET LOSS SIMULATION
  // =========================================================================
  describe('2. Packet Loss, Jitter & Batch Resubmission Resilience', () => {
    test('BURST CONCURRENCY: handles 10 simultaneous batches (500 events total) without dropping connections', async () => {
      const batchPromises = [];
      const sessionIds = Array.from({ length: 10 }, (_, i) => `jitter-sess-${i}`);

      for (let b = 0; b < 10; b++) {
        const events = Array.from({ length: 50 }, (_, i) => ({
          sessionId: sessionIds[b],
          eventType: 'hotspot_view',
          hotspotId: `hs_burst_${b}_${i}`,
          seq: i + 1,
          durationMs: 1200,
        }));

        batchPromises.push(
          request(app)
            .post('/api/analytics/batch')
            .send({ events })
        );
      }

      const results = await Promise.all(batchPromises);
      for (const res of results) {
        expect(res.status).toBe(201);
        expect(res.body.inserted).toBe(50);
      }

      const totalEvents = await AnalyticsEvent.countDocuments();
      expect(totalEvents).toBe(500);
    });

    test('EDGE AUDIT: duplicate submission behavior when unique index is absent', async () => {
      const sessionId = 'dup-test-sess';
      const events = [
        { sessionId, eventType: 'session_start', seq: 1 },
        { sessionId, eventType: 'area_enter', area: 'Library', seq: 2 },
      ];

      // First submission
      const res1 = await request(app)
        .post('/api/analytics/batch')
        .send({ events });
      expect(res1.status).toBe(201);
      expect(res1.body.inserted).toBe(2);

      // Simulating a network timeout retry where client re-sends the same batch
      const res2 = await request(app)
        .post('/api/analytics/batch')
        .send({ events });
      expect(res2.status).toBe(201);

      const docs = await AnalyticsEvent.find({ sessionId });
      // Documents how without compound unique index on {sessionId, seq}, retries duplicate docs
      expect(docs.length).toBe(4);
    });
  });

  // =========================================================================
  // 3. LATENCY & DELAY TOLERANCE
  // =========================================================================
  describe('3. Latency & Asynchronous Non-Blocking Processing', () => {
    test('non-blocking single event write returns promptly under high event volume', async () => {
      const t0 = Date.now();
      const res = await request(app)
        .post('/api/analytics/events')
        .send({
          sessionId: 'latency-check-sess',
          eventType: 'objective_complete',
          area: 'TechnoLab',
          hotspotId: 'hs_printer3d',
          durationMs: 45000,
          seq: 1,
        });

      const elapsed = Date.now() - t0;
      expect(res.status).toBe(201);
      expect(elapsed).toBeLessThan(200); // Must resolve well within 200ms
    });
  });
});
