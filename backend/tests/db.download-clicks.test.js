/**
 * Landing-page Download button click counts against a real MongoDB.
 *
 * Clicks are recorded publicly (anyone on the landing page) and read back as
 * per-platform counts by the dashboard.
 */
const request = require('supertest');
const app = require('../src/app');
const DownloadClick = require('../src/models/DownloadClick');
const { signSessionToken } = require('../src/utils/jwt');
const { describeDb, connect, disconnect, clear } = require('./helpers/db');

const viewerToken = signSessionToken({ _id: 'v1', email: 'v@bc.ac.za', role: 'viewer', name: 'V' });

describeDb('download button clicks (database-backed)', () => {
  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(clear);

  test('records a click for each platform', async () => {
    for (const platform of ['windows', 'android', 'windows']) {
      const res = await request(app).post('/api/downloads/clicks').send({ platform });
      expect(res.status).toBe(201);
    }
    expect(await DownloadClick.countDocuments({ platform: 'windows' })).toBe(2);
    expect(await DownloadClick.countDocuments({ platform: 'android' })).toBe(1);
  });

  test('rejects an unknown platform and stores nothing', async () => {
    const res = await request(app).post('/api/downloads/clicks').send({ platform: 'quest' });
    expect(res.status).toBe(400);
    expect(await DownloadClick.countDocuments()).toBe(0);
  });

  test('counts clicks per platform, including zero', async () => {
    await DownloadClick.create([{ platform: 'windows' }, { platform: 'windows' }, { platform: 'windows' }]);
    const res = await request(app).get('/api/downloads/clicks').set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ windows: 3, android: 0, total: 3, timeframe: 'all' });
  });

  test('timeframe leaves out older clicks', async () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await DownloadClick.collection.insertMany([
      { platform: 'android', createdAt: old, updatedAt: old },
      { platform: 'android', createdAt: new Date(), updatedAt: new Date() },
    ]);
    const res = await request(app)
      .get('/api/downloads/clicks?timeframe=7d')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.body).toMatchObject({ android: 1, total: 1, timeframe: '7d' });
  });
});
