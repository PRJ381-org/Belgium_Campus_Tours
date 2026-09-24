/**
 * System Status endpoint against a real MongoDB. Remote (GitHub) link checks
 * are skipped under NODE_ENV=test so this never touches the internet.
 */
const request = require('supertest');
const app = require('../src/app');
const AnalyticsEvent = require('../src/models/AnalyticsEvent');
const Lead = require('../src/models/Lead');
const { signSessionToken } = require('../src/utils/jwt');
const { describeDb, connect, disconnect, clear } = require('./helpers/db');

const adminToken = signSessionToken({ _id: 'a1', email: 'a@bc.ac.za', role: 'admin', name: 'A' });

describeDb('GET /api/status (database-backed)', () => {
  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(clear);

  test('reports server, database, telemetry, activity and downloads', async () => {
    await AnalyticsEvent.create({ sessionId: 's1', eventType: 'session_start' });
    await AnalyticsEvent.create({ sessionId: 's2', eventType: 'area_enter', area: 'Library' });
    await Lead.create({ email: 'x@example.com', source: 'end_screen' });

    const res = await request(app).get('/api/status').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    expect(res.body.server).toMatchObject({ status: 'ok', env: 'test' });
    expect(res.body.database.state).toBe('connected');
    expect(typeof res.body.database.pingMs).toBe('number');

    expect(res.body.telemetry).toMatchObject({ events24h: 2, sessions24h: 2, lastEventType: 'area_enter' });
    expect(res.body.activity).toMatchObject({ leads24h: 1, feedback24h: 0, ticketsNeedingReply: 0 });

    const keys = res.body.downloads.platforms.map((p) => p.key);
    expect(keys).toEqual(['vr', 'desktop', 'mobile']);
    res.body.downloads.platforms.forEach((p) => {
      expect(p.landingPath).toBe(`/api/download/${p.key}`);
      expect(typeof p.local.present).toBe('boolean');
      expect(p.github).toBeNull(); // not checked in tests
    });
  });
});
