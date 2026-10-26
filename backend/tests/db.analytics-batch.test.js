/**
 * Batch ingest against a real MongoDB.
 *
 * The behaviour under test is retry safety. A headset that loses Wi-Fi mid-flush
 * cannot know whether its batch landed, so it resends - and we must absorb that
 * without either losing events or double-counting them.
 */
const request = require('supertest');
const app = require('../src/app');
const AnalyticsEvent = require('../src/models/AnalyticsEvent');
const { createEventsBatch } = require('../src/controllers/analytics.controller');
const { describeDb, connect, disconnect, clear } = require('./helpers/db');

const mkEvent = (seq, over = {}) => ({
  sessionId: 'sess-a',
  eventType: 'area_enter',
  area: 'library',
  seq,
  ...over,
});

describeDb('POST /api/analytics/batch (database-backed)', () => {
  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(clear);

  test('persists every event in the batch', async () => {
    const events = [mkEvent(1), mkEvent(2), mkEvent(3)];
    const res = await request(app).post('/api/analytics/batch').send({ events });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ received: 3, inserted: 3, duplicates: 0, failed: 0 });
    expect(await AnalyticsEvent.countDocuments()).toBe(3);
  });

  test('stores the new build-provenance fields', async () => {
    await request(app)
      .post('/api/analytics/batch')
      .send({ events: [mkEvent(1, { platform: 'Android', buildId: 'ci-42', appVersion: '0.2.0' })] });

    const doc = await AnalyticsEvent.findOne({ seq: 1 });
    expect(doc.platform).toBe('Android');
    expect(doc.buildId).toBe('ci-42');
    expect(doc.appVersion).toBe('0.2.0');
  });

  test('accepts objective_complete, the newly added event type', async () => {
    const res = await request(app)
      .post('/api/analytics/batch')
      .send({ events: [mkEvent(1, { eventType: 'objective_complete' })] });

    expect(res.status).toBe(201);
    expect(await AnalyticsEvent.countDocuments({ eventType: 'objective_complete' })).toBe(1);
  });

  test('accepts game_download, logged by the website download routes', async () => {
    await AnalyticsEvent.create({
      sessionId: 'web-dl-test',
      eventType: 'game_download',
      area: 'WebDownloadPortal',
      hotspotId: 'mobile_build',
      durationMs: 0,
      seq: 1,
    });

    expect(await AnalyticsEvent.countDocuments({ eventType: 'game_download' })).toBe(1);
  });

  test('a full 200-event batch round-trips', async () => {
    const events = Array.from({ length: 200 }, (_, i) => mkEvent(i));
    const res = await request(app).post('/api/analytics/batch').send({ events });

    expect(res.status).toBe(201);
    expect(res.body.inserted).toBe(200);
    expect(await AnalyticsEvent.countDocuments()).toBe(200);
  });

  test('reported counts always reconcile against what was received', async () => {
    const events = Array.from({ length: 25 }, (_, i) => mkEvent(i));
    const { body } = await request(app).post('/api/analytics/batch').send({ events });

    expect(body.inserted + body.duplicates + body.failed).toBe(body.received);
    expect(body.received).toBe(25);
  });

  describe('with the Phase 5 unique {sessionId, seq} index applied', () => {
    // Phase 5 is not enabled in production yet. Building the index here proves
    // the batch endpoint is already safe for the day it is switched on - the
    // alternative is discovering it 500s on a retry during the open day.
    beforeEach(async () => {
      await AnalyticsEvent.collection.createIndex({ sessionId: 1, seq: 1 }, { unique: true });
    });

    afterEach(async () => {
      await AnalyticsEvent.collection.dropIndexes();
    });

    test('resending an identical batch is idempotent', async () => {
      const events = [mkEvent(1), mkEvent(2), mkEvent(3)];

      const first = await request(app).post('/api/analytics/batch').send({ events });
      expect(first.body).toMatchObject({ inserted: 3, duplicates: 0, failed: 0 });

      const retry = await request(app).post('/api/analytics/batch').send({ events });
      expect(retry.status).toBe(201);
      expect(retry.body).toMatchObject({ inserted: 0, duplicates: 3, failed: 0 });

      // The whole point: a retry must not multiply the data.
      expect(await AnalyticsEvent.countDocuments()).toBe(3);
    });

    test('a partially-overlapping retry inserts only what is new', async () => {
      // The realistic case: the client resends its buffer, some of which we
      // already have. Duplicates must not block the events behind them, which
      // is what ordered:false buys us.
      await request(app).post('/api/analytics/batch').send({ events: [mkEvent(1), mkEvent(2)] });

      const res = await request(app)
        .post('/api/analytics/batch')
        .send({ events: [mkEvent(1), mkEvent(2), mkEvent(3), mkEvent(4)] });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ received: 4, inserted: 2, duplicates: 2, failed: 0 });
      expect(await AnalyticsEvent.countDocuments()).toBe(4);
    });

    test('duplicates are reported as duplicates, never as failures', async () => {
      await request(app).post('/api/analytics/batch').send({ events: [mkEvent(1)] });
      const res = await request(app).post('/api/analytics/batch').send({ events: [mkEvent(1)] });

      expect(res.body.failed).toBe(0);
      expect(res.body.duplicates).toBe(1);
    });

    test('different sessions may reuse the same seq numbers', async () => {
      const res = await request(app).post('/api/analytics/batch').send({
        events: [mkEvent(1), mkEvent(1, { sessionId: 'sess-b' })],
      });

      expect(res.body).toMatchObject({ inserted: 2, duplicates: 0 });
    });
  });

  test('silently-dropped documents are counted as failed, not ignored', async () => {
    // An unordered insertMany discards schema-invalid docs WITHOUT throwing, so
    // they appear in neither the result nor any error. The controller derives
    // `failed` as the remainder to catch that. Reaching this path means going
    // around express-validator, so the controller is called directly.
    const req = {
      body: { events: [mkEvent(1), mkEvent(2, { eventType: 'not-a-real-type' }), mkEvent(3)] },
    };
    let payload;
    const res = {
      status() { return this; },
      json(body) { payload = body; return this; },
    };

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let warnings;
    try {
      await createEventsBatch(req, res, (err) => { throw err; });
    } finally {
      // Read the calls BEFORE restoring: mockRestore() also resets mock state,
      // so asserting on the spy afterwards would always see zero calls.
      warnings = warn.mock.calls.map((args) => String(args[0]));
      warn.mockRestore();
    }

    expect(payload).toMatchObject({ received: 3, inserted: 2, duplicates: 0, failed: 1 });
    expect(await AnalyticsEvent.countDocuments()).toBe(2);

    // Dropped events must be visible in the logs, otherwise the only trace of
    // lost telemetry is a number in a response body nobody reads.
    expect(warnings).toEqual([expect.stringContaining('1/3 events rejected')]);
  });
});
