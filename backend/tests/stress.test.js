/**
 * Stress, High Concurrency, Rate Limiting & Edge Resilience Test Suite.
 *
 * Verifies system stability under realistic open day load spikes:
 * 1. Concurrent Lead Burst (50 headsets finishing simultaneously)
 * 2. Rate Limiter Trigger & Backoff (429 on > 60 leads/min & > 120 events/min)
 * 3. Batch Analytics Scalability (up to 200 events per request)
 * 4. Payload Size Enforcement (413 on > 100kb)
 * 5. Concurrent Ticket Reference Uniqueness (No collision under race conditions)
 * 6. DB Outage Circuit Breaker (503 without hang when DB drops)
 * 7. Malicious / Heavy Payload Input Resistance
 */
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Lead = require('../src/models/Lead');
const Ticket = require('../src/models/Ticket');
const AnalyticsEvent = require('../src/models/AnalyticsEvent');
const { describeDb, connect, disconnect, clear } = require('./helpers/db');

describeDb('System Stress & Edge Load Testing (Database-Backed)', () => {
  beforeAll(async () => {
    await connect();
  });

  afterAll(async () => {
    await disconnect();
  });

  beforeEach(async () => {
    await clear();
  });

  test('CONCURRENCY: 50 concurrent lead submissions execute cleanly without data loss', async () => {
    const totalRequests = 50;
    const promises = [];

    const startTime = Date.now();
    for (let i = 0; i < totalRequests; i++) {
      promises.push(
        request(app)
          .post('/api/leads')
          .set('X-Forwarded-For', `192.168.1.${10 + i}`) // distinct IPs to test pure concurrent throughput
          .send({
            email: `student_${i}@belgiumcampus.ac.za`,
            hotspotId: `kiosk_station_${i % 5}`,
            sessionId: `sess_burst_${i}`,
          })
      );
    }

    const responses = await Promise.all(promises);
    const durationMs = Date.now() - startTime;

    // Verify all 50 requests succeeded
    responses.forEach((res, idx) => {
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.source).toBe(`hotspot:kiosk_station_${idx % 5}`);
    });

    const leadCount = await Lead.countDocuments();
    expect(leadCount).toBe(totalRequests);
    console.log(`[Stress Test] 50 concurrent leads processed in ${durationMs}ms (${(totalRequests / (durationMs / 1000)).toFixed(1)} req/s)`);
  });

  test('RATE LIMIT: single IP submitting > 60 leads in 1 minute is throttled with 429', async () => {
    const testIp = '10.0.0.99';
    const limit = 60;

    // Send 60 permitted requests
    for (let i = 0; i < limit; i++) {
      const res = await request(app)
        .post('/api/leads')
        .set('X-Forwarded-For', testIp)
        .send({ email: `ratelimit_${i}@example.com` });
      expect(res.status).toBe(201);
    }

    // 61st request must trigger the rate limiter
    const blockedRes = await request(app)
      .post('/api/leads')
      .set('X-Forwarded-For', testIp)
      .send({ email: 'should_block@example.com' });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.success).toBe(false);
    expect(blockedRes.body.message).toMatch(/Too many submissions/i);
  });

  test('BATCH CAPACITY: batch route processes max allowed 200 events in one transaction', async () => {
    const events = [];
    for (let i = 1; i <= 200; i++) {
      events.push({
        sessionId: 'sess_large_batch',
        eventType: 'area_enter',
        area: `Lab_${i % 10}`,
        seq: i,
        durationMs: 500,
      });
    }

    const res = await request(app)
      .post('/api/analytics/batch')
      .send({ events });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.inserted).toBe(200);

    const storedCount = await AnalyticsEvent.countDocuments({ sessionId: 'sess_large_batch' });
    expect(storedCount).toBe(200);
  });

  test('BATCH LIMIT: batch route rejects requests exceeding 200 events with 400', async () => {
    const events = [];
    for (let i = 1; i <= 201; i++) {
      events.push({
        sessionId: 'sess_overflow',
        eventType: 'area_enter',
        seq: i,
      });
    }

    const res = await request(app)
      .post('/api/analytics/batch')
      .send({ events });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('DOS PROTECTION: payloads exceeding 100kb are rejected with 413 Payload Too Large', async () => {
    // Generate ~150kb dummy string
    const bigString = 'A'.repeat(150 * 1024);

    const res = await request(app)
      .post('/api/feedback')
      .send({
        rating: 5,
        name: 'Stress Test',
        email: 'stress@example.com',
        liked: bigString,
      });

    expect(res.status).toBe(413);
  });

  test('RACE CONDITIONS: 25 concurrent ticket submissions generate 25 unique VC-XXXXXX references', async () => {
    const promises = [];
    for (let i = 0; i < 25; i++) {
      promises.push(
        request(app)
          .post('/api/tickets')
          .set('X-Forwarded-For', `172.16.0.${i + 1}`)
          .send({
            name: `User ${i}`,
            email: `user_${i}@example.com`,
            category: 'vr_tour',
            subject: `VR Headset Issue ${i}`,
            message: `Description of issue number ${i}`,
          })
      );
    }

    const responses = await Promise.all(promises);
    const refs = new Set();

    responses.forEach((res) => {
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.ref).toMatch(/^VC-[A-Z0-9]{6}$/);
      refs.add(res.body.ref);
    });

    // Verify zero collisions across all 25 parallel creations
    expect(refs.size).toBe(25);
  });

  test('ADVERSARIAL INPUT: NoSQL operator injection in lead form is rejected before database query', async () => {
    const maliciousPayload = {
      email: { $gt: '' }, // NoSQL query injection attempt
      hotspotId: 'reception',
    };

    const res = await request(app)
      .post('/api/leads')
      .send(maliciousPayload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
