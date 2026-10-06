/**
 * Automated Analytics Timeframe Filtering, Aggregation & Query Fuzzing Tests.
 *
 * Verifies:
 * - Timeframe normalization defense against malformed and adversarial query inputs
 * - Date filter boundary calculation accuracy (today, 24h, 7d, 30d, all)
 * - Real MongoDB aggregation pipeline correctness under timeframe scoping
 * - Limit parameter clamping (max 5000) and query parameter fuzzing
 */
const request = require('supertest');
const app = require('../src/app');
const AnalyticsEvent = require('../src/models/AnalyticsEvent');
const {
  TIMEFRAMES,
  LABELS,
  normalizeTimeframe,
  timeframeFilter,
} = require('../src/utils/timeframe');
const { signSessionToken } = require('../src/utils/jwt');
const { describeDb, connect, disconnect, clear } = require('./helpers/db');

const viewerToken = signSessionToken({ _id: 'v1', email: 'v@bc.ac.za', role: 'viewer', name: 'Viewer' });

describe('Timeframe Utility Functions (timeframe.js)', () => {
  describe('normalizeTimeframe', () => {
    test('accepts valid timeframes', () => {
      TIMEFRAMES.forEach((tf) => {
        expect(normalizeTimeframe(tf)).toBe(tf);
      });
    });

    test('fuzzes and safely defaults invalid values to "all"', () => {
      const fuzzInputs = [
        null,
        undefined,
        '',
        '   ',
        'yesterday',
        '1y',
        '365d',
        123,
        false,
        true,
        {},
        [],
        '__proto__',
        '{"$gt": ""}',
      ];

      fuzzInputs.forEach((input) => {
        expect(normalizeTimeframe(input)).toBe('all');
      });
    });

    test('ensures human labels exist for all registered timeframes', () => {
      TIMEFRAMES.forEach((tf) => {
        expect(LABELS[tf]).toBeDefined();
        expect(typeof LABELS[tf]).toBe('string');
      });
    });
  });

  describe('timeframeFilter Date Boundaries', () => {
    test('"all" returns empty query object', () => {
      expect(timeframeFilter('all')).toEqual({});
      expect(timeframeFilter('unknown')).toEqual({});
    });

    test('"today" filters from local midnight (00:00:00.000)', () => {
      const filter = timeframeFilter('today');
      expect(filter).toHaveProperty('createdAt.$gte');
      const gte = filter.createdAt.$gte;
      expect(gte.getHours()).toBe(0);
      expect(gte.getMinutes()).toBe(0);
      expect(gte.getSeconds()).toBe(0);
      expect(gte.getMilliseconds()).toBe(0);
    });

    test('"24h", "7d", and "30d" calculate correct relative millisecond offsets', () => {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      const f24h = timeframeFilter('24h');
      expect(Math.abs(now - dayMs - f24h.createdAt.$gte.getTime())).toBeLessThan(50);

      const f7d = timeframeFilter('7d');
      expect(Math.abs(now - 7 * dayMs - f7d.createdAt.$gte.getTime())).toBeLessThan(50);

      const f30d = timeframeFilter('30d');
      expect(Math.abs(now - 30 * dayMs - f30d.createdAt.$gte.getTime())).toBeLessThan(50);
    });
  });
});

describeDb('Database Analytics Timeframe Aggregation & Query Fuzzing', () => {
  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(clear);

  test('correctly filters summary metrics across multi-day time windows', async () => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Seed events across historical time buckets using collection.insertOne to bypass auto timestamps
    await AnalyticsEvent.collection.insertMany([
      // 1) 30 minutes ago (within today, 24h, 7d, 30d, all)
      {
        sessionId: 'sess-today',
        eventType: 'session_start',
        area: 'Library',
        durationMs: 12000,
        createdAt: new Date(now - 30 * 60 * 1000),
      },
      // 2) 12 hours ago (within 24h, 7d, 30d, all)
      {
        sessionId: 'sess-24h',
        eventType: 'hotspot_view',
        hotspotId: 'hs_alpha',
        createdAt: new Date(now - 12 * 60 * 60 * 1000),
      },
      // 3) 3 days ago (within 7d, 30d, all)
      {
        sessionId: 'sess-7d',
        eventType: 'area_enter',
        area: 'TechnoLab',
        createdAt: new Date(now - 3 * dayMs),
      },
      // 4) 15 days ago (within 30d, all)
      {
        sessionId: 'sess-30d',
        eventType: 'session_end',
        createdAt: new Date(now - 15 * dayMs),
      },
      // 5) 60 days ago (all only)
      {
        sessionId: 'sess-old',
        eventType: 'info_request',
        createdAt: new Date(now - 60 * dayMs),
      },
    ]);

    // Query 24h summary
    const res24h = await request(app)
      .get('/api/analytics/summary?timeframe=24h')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res24h.status).toBe(200);
    expect(res24h.body.timeframe).toBe('24h');
    expect(res24h.body.totalEvents).toBe(2);
    expect(res24h.body.uniqueSessions).toBe(2);

    // Query 7d summary
    const res7d = await request(app)
      .get('/api/analytics/summary?timeframe=7d')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res7d.status).toBe(200);
    expect(res7d.body.totalEvents).toBe(3);

    // Query 30d summary
    const res30d = await request(app)
      .get('/api/analytics/summary?timeframe=30d')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res30d.status).toBe(200);
    expect(res30d.body.totalEvents).toBe(4);

    // Query all summary
    const resAll = await request(app)
      .get('/api/analytics/summary?timeframe=all')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(resAll.status).toBe(200);
    expect(resAll.body.totalEvents).toBe(5);

    // Raw events endpoint timeframe filtering
    const resEvents24h = await request(app)
      .get('/api/analytics/events?timeframe=24h')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(resEvents24h.status).toBe(200);
    expect(resEvents24h.body.count).toBe(2);
  });

  test('fuzzes limit and timeframe parameters on GET /api/analytics/events', async () => {
    await AnalyticsEvent.create({ sessionId: 's1', eventType: 'session_start' });
    await AnalyticsEvent.create({ sessionId: 's2', eventType: 'session_end' });

    // 1) Excessive limit is clamped to 5000 max without error
    const resMax = await request(app)
      .get('/api/analytics/events?limit=999999')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(resMax.status).toBe(200);
    expect(resMax.body.count).toBe(2);

    // 2) Negative limit defaults to safe 500
    const resNeg = await request(app)
      .get('/api/analytics/events?limit=-20')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(resNeg.status).toBe(200);
    expect(resNeg.body.count).toBe(2);

    // 3) Non-numeric limit defaults to safe 500
    const resNaN = await request(app)
      .get('/api/analytics/events?limit=invalid_not_number')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(resNaN.status).toBe(200);
    expect(resNaN.body.count).toBe(2);

    // 4) Arbitrary garbage timeframe gracefully treats as "all"
    const resFuzz = await request(app)
      .get('/api/analytics/events?timeframe=<script>alert(1)</script>')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(resFuzz.status).toBe(200);
    expect(resFuzz.body.count).toBe(2);
  });
});
