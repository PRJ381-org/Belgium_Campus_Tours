/**
 * Server-side authorisation contract.
 *
 * The dashboard now sits at "/" inside the same Express app that serves the API,
 * and its own gating (requireLogin() -> login.html) is presentation only. Anyone
 * can skip it by calling the API directly with curl. This suite is what actually
 * proves the data is protected.
 *
 * It deliberately runs with NO database connected. A route that answers 401
 * without a database has rejected the caller before reaching any data access -
 * which is the property we want. If a guard were ever removed, the request would
 * fall through to Mongoose and hang or 500 instead, and these tests would fail.
 */
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const { signSessionToken } = require('../src/utils/jwt');

// With no connection, Mongoose buffers queries for 10s before giving up. The
// "valid token gets past the guard" cases below deliberately reach the data
// layer, so without this the suite spends ~40s waiting on buffers it knows will
// never drain.
mongoose.set('bufferTimeoutMS', 200);

const viewerToken = signSessionToken({ _id: 'u1', email: 'v@bc.ac.za', role: 'viewer', name: 'V' });
const adminToken = signSessionToken({ _id: 'u2', email: 'a@bc.ac.za', role: 'admin', name: 'A' });

// Every endpoint that returns data. Split by the privilege each one demands.
const AUTHENTICATED_ROUTES = [
  ['get', '/api/leads'],
  ['get', '/api/analytics/events'],
  ['get', '/api/analytics/summary'],
  ['get', '/api/auth/me'],
  ['get', '/api/auth/me/avatar'],
  ['put', '/api/auth/me/avatar'],
  ['delete', '/api/auth/me/avatar'],
];

const ADMIN_ONLY_ROUTES = [
  ['get', '/api/auth/users'],
  ['get', '/api/export/summary'],
  ['get', '/api/export/leads'],
  ['get', '/api/export/analytics'],
  ['get', '/api/feedback'],
];

const ALL_PROTECTED = [...AUTHENTICATED_ROUTES, ...ADMIN_ONLY_ROUTES];

describe('protected routes reject anonymous callers', () => {
  test.each(ALL_PROTECTED)('%s %s -> 401 with no token', async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test.each(ALL_PROTECTED)('%s %s -> 401 with a garbage bearer token', async (method, path) => {
    const res = await request(app)[method](path).set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
  });

  // requireAuth also accepts ?token= because CSV download links cannot set
  // headers. That second doorway must be just as strict as the first.
  test.each(ALL_PROTECTED)('%s %s -> 401 with a garbage ?token= query', async (method, path) => {
    const res = await request(app)[method](`${path}?token=not.a.jwt`);
    expect(res.status).toBe(401);
  });

  // A token signed with the wrong secret is the realistic forgery attempt.
  test.each(ALL_PROTECTED)('%s %s -> 401 with a foreign-signed token', async (method, path) => {
    // eslint-disable-next-line global-require
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign({ id: 'x', role: 'admin' }, 'a-different-secret');
    const res = await request(app)[method](path).set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });
});

describe('admin-only routes reject an authenticated non-admin', () => {
  test.each(ADMIN_ONLY_ROUTES)('%s %s -> 403 for a viewer', async (method, path) => {
    const res = await request(app)[method](path).set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
  });
});

describe('a valid token passes the guard', () => {
  // Proves the 401s above come from the guard rather than from every request
  // failing for some unrelated reason. With no DB these get past auth and then
  // stall at the data layer, so anything that is NOT 401/403 means the guard let
  // us through - which is the assertion.
  test.each(ALL_PROTECTED)('%s %s admits a valid admin token', async (method, path) => {
    const res = await request(app)[method](path)
      .set('Authorization', `Bearer ${adminToken}`)
      .catch((err) => err);

    const status = res.status ?? 0;
    expect([401, 403]).not.toContain(status);
  });
});

describe('public ingest routes stay open to the headset', () => {
  // The Unreal client has no user to authenticate as. These must NOT be 401 -
  // if they ever become protected, telemetry silently stops on the open day.
  const PUBLIC_POSTS = [
    ['/api/analytics/events', { sessionId: 's', eventType: 'session_start' }],
    ['/api/analytics/batch', { events: [{ sessionId: 's', eventType: 'session_start' }] }],
    ['/api/leads', { email: 'someone@example.com' }],
  ];

  test.each(PUBLIC_POSTS)('POST %s is not rejected as unauthenticated', async (path, payload) => {
    const res = await request(app).post(path).send(payload).catch((err) => err);
    expect(res.status ?? 0).not.toBe(401);
  });

  test('GET /health is public', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  test('GET / serves the dashboard shell without a token', async () => {
    // Unauthenticated visitors must reach the page; the page then redirects
    // itself to login.html. Serving it is not a data leak - it ships no data.
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });
});
