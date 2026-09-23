/**
 * Host-independent behaviour: health reporting, CORS allowlisting, and the
 * dashboard/API co-hosting introduced by the Hostinger merge. None of this needs
 * a database, so it runs everywhere.
 */
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const { version } = require('../package.json');

// This suite runs with no database on purpose. A few cases check that a request
// gets PAST validation, which means it reaches the data layer and stalls there -
// so fail those buffers fast instead of waiting out Mongoose's 10s default.
mongoose.set('bufferTimeoutMS', 200);

describe('GET /health', () => {
  test('answers 200 and reports version and db state', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    // The dashboard is deployed as part of this app, so a version bump landing
    // in /health is how we confirm a zip upload actually replaced the old code.
    expect(res.body.version).toBe(version);
    expect(res.body).toHaveProperty('startedAt');
    expect(res.body).toHaveProperty('dbState');
  });

  test('stays 200 even with no database, so a health probe will not restart us', async () => {
    // Returning 5xx here would make Azure/Passenger recycle the process on every
    // Atlas blip, turning a recoverable outage into a restart loop.
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.db).toBe('disconnected');
  });
});

describe('CORS allowlist', () => {
  // CORS_ORIGIN is set to a two-entry list in tests/helpers/testEnv.js.
  test('allows a listed origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://dashboard.example.com');
    expect(res.headers['access-control-allow-origin']).toBe('https://dashboard.example.com');
  });

  test('allows the second listed origin (list is split, not compared whole)', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://second.example.com');
    expect(res.headers['access-control-allow-origin']).toBe('https://second.example.com');
  });

  test('does not echo an unlisted origin back', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('serves callers with no Origin header at all (the Unreal client, curl)', async () => {
    // CORS is a browser mechanism. The headset sends no Origin, and must never
    // be blocked by the allowlist.
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});

describe('dashboard is served by the same app as the API', () => {
  test('GET / returns the dashboard HTML', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  test('GET /login.html is reachable', async () => {
    const res = await request(app).get('/login.html');
    expect(res.status).toBe(200);
  });

  // public/ is the Vite build of client/, so bundle names are hashed - follow
  // the <script>/<link> tags in each page instead of hard-coding paths.
  async function pageAssets(page) {
    const res = await request(app).get(page);
    return [...res.text.matchAll(/(?:src|href)="\.?\/?(static\/[^"]+)"/g)].map((m) => `/${m[1]}`);
  }

  test('static assets resolve', async () => {
    const assets = await pageAssets('/');
    const cssPath = assets.find((a) => a.endsWith('.css'));
    expect(cssPath).toBeDefined();
    const css = await request(app).get(cssPath);
    expect(css.status).toBe(200);
    expect(css.headers['content-type']).toMatch(/css/);

    const logo = await request(app).get('/assets/logo.png');
    expect(logo.status).toBe(200);
  });

  test('bundled JS calls the API with relative URLs, so the build is host-portable', async () => {
    // A hard-coded host here is what would break the move to Hostinger.
    const pages = ['/', '/login.html', '/dashboard.html'];
    const scripts = new Set((await Promise.all(pages.map(pageAssets))).flat().filter((a) => a.endsWith('.js')));
    expect(scripts.size).toBeGreaterThan(0);

    for (const script of scripts) {
      const res = await request(app).get(script);
      expect(res.status).toBe(200);
      expect(res.text).not.toMatch(/https?:\/\/localhost/);
      expect(res.text).not.toMatch(/azurewebsites\.net/);
    }
  });

  test('old /dashboard links still redirect to /', async () => {
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });

  test('a missing static file 404s rather than serving the dashboard shell', async () => {
    const res = await request(app).get('/definitely-not-here.html');
    expect(res.status).toBe(404);
  });

  test('API routes are not shadowed by the static handler', async () => {
    // /health is mounted before express.static; if that order ever flipped, a
    // file named health in public/ would take priority.
    const res = await request(app).get('/health');
    expect(res.body.status).toBe('ok');
  });
});

describe('request validation', () => {
  test('rejects a lead with no email', async () => {
    const res = await request(app).post('/api/leads').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('rejects a lead with a malformed email', async () => {
    const res = await request(app).post('/api/leads').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  test('rejects an event with an unknown eventType', async () => {
    const res = await request(app)
      .post('/api/analytics/events')
      .send({ sessionId: 's1', eventType: 'nonsense' });
    expect(res.status).toBe(400);
  });

  test('rejects an event with no sessionId', async () => {
    const res = await request(app).post('/api/analytics/events').send({ eventType: 'session_start' });
    expect(res.status).toBe(400);
  });

  test('accepts objective_complete as a valid event type', async () => {
    // Newly added to the enum; a 400 here would mean the client's events are
    // being thrown away.
    const res = await request(app)
      .post('/api/analytics/events')
      .send({ sessionId: 's1', eventType: 'objective_complete' })
      .catch((err) => err);
    expect(res.status ?? 0).not.toBe(400);
  });
});

describe('POST /api/analytics/batch input limits', () => {
  const event = { sessionId: 's1', eventType: 'area_enter' };

  test('rejects a missing events array', async () => {
    const res = await request(app).post('/api/analytics/batch').send({});
    expect(res.status).toBe(400);
  });

  test('rejects an empty batch', async () => {
    const res = await request(app).post('/api/analytics/batch').send({ events: [] });
    expect(res.status).toBe(400);
  });

  test('rejects a batch over the 200-event cap', async () => {
    const res = await request(app)
      .post('/api/analytics/batch')
      .send({ events: Array.from({ length: 201 }, () => event) });
    expect(res.status).toBe(400);
  });

  test('rejects a batch containing one invalid event', async () => {
    const res = await request(app)
      .post('/api/analytics/batch')
      .send({ events: [event, { sessionId: 's1', eventType: 'nonsense' }] });
    expect(res.status).toBe(400);
  });

  test('accepts exactly 200 events (the cap is inclusive)', async () => {
    const res = await request(app)
      .post('/api/analytics/batch')
      .send({ events: Array.from({ length: 200 }, () => event) })
      .catch((err) => err);
    expect(res.status ?? 0).not.toBe(400);
  });
});
