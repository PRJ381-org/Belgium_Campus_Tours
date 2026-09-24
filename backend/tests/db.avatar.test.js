/**
 * Profile pictures against a real MongoDB.
 *
 * Users can only ever read or change their OWN avatar (the id comes from the
 * JWT, never the request). The admin user list includes avatars so the Users
 * table can show them.
 */
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const { signSessionToken } = require('../src/utils/jwt');
const { describeDb, connect, disconnect, clear } = require('./helpers/db');

// Smallest valid PNG (1x1 transparent pixel).
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describeDb('profile picture routes (database-backed)', () => {
  let alice;
  let bob;
  let aliceToken;

  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(async () => {
    await clear();
    alice = await User.create({ email: 'alice@bc.ac.za', name: 'Alice', role: 'admin' });
    bob = await User.create({ email: 'bob@bc.ac.za', name: 'Bob' });
    aliceToken = signSessionToken(alice);
  });

  const auth = (req) => req.set('Authorization', `Bearer ${aliceToken}`);

  test('starts empty', async () => {
    const res = await auth(request(app).get('/api/auth/me/avatar'));
    expect(res.status).toBe(200);
    expect(res.body.avatar).toBe('');
  });

  test('sets, reads back and deletes the caller\'s avatar', async () => {
    const put = await auth(request(app).put('/api/auth/me/avatar')).send({ avatar: TINY_PNG });
    expect(put.status).toBe(200);

    const get = await auth(request(app).get('/api/auth/me/avatar'));
    expect(get.body.avatar).toBe(TINY_PNG);

    const del = await auth(request(app).delete('/api/auth/me/avatar'));
    expect(del.status).toBe(200);
    const stored = await User.findById(alice._id).select('+avatar');
    expect(stored.avatar).toBe('');
  });

  test('only changes the caller, never another user', async () => {
    await auth(request(app).put('/api/auth/me/avatar')).send({ avatar: TINY_PNG });
    const other = await User.findById(bob._id).select('+avatar');
    expect(other.avatar).toBe('');
  });

  test.each([
    ['not a data URL', 'https://evil.example/pic.png'],
    ['an SVG (can carry scripts)', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='],
    ['too large', `data:image/png;base64,${'A'.repeat(90000)}`],
    ['not a string', 12345],
  ])('rejects %s', async (_label, avatar) => {
    const res = await auth(request(app).put('/api/auth/me/avatar')).send({ avatar });
    expect(res.status).toBe(400);
  });

  test('admin user list includes avatars (and never password hashes)', async () => {
    await auth(request(app).put('/api/auth/me/avatar')).send({ avatar: TINY_PNG });
    const res = await auth(request(app).get('/api/auth/users'));
    expect(res.status).toBe(200);
    const byEmail = Object.fromEntries(res.body.users.map((u) => [u.email, u]));
    expect(byEmail['alice@bc.ac.za'].avatar).toBe(TINY_PNG);
    expect(byEmail['bob@bc.ac.za'].avatar).toBe('');
    expect(res.body.users.every((u) => u.password === undefined)).toBe(true);
  });
});
