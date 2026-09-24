/**
 * Open Day feedback form against a real MongoDB.
 *
 * The form is public (anyone on the landing page can submit) so these pin the
 * validation, the honeypot, and that only admins can read or export it.
 */
const request = require('supertest');
const app = require('../src/app');
const Feedback = require('../src/models/Feedback');
const { signSessionToken } = require('../src/utils/jwt');
const { describeDb, connect, disconnect, clear } = require('./helpers/db');

const adminToken = signSessionToken({ _id: 'a1', email: 'a@bc.ac.za', role: 'admin', name: 'A' });

describeDb('feedback form (database-backed)', () => {
  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(clear);

  test('stores a full submission', async () => {
    const res = await request(app).post('/api/feedback').send({
      rating: 5,
      visitorType: 'prospective_student',
      platform: 'vr',
      liked: 'The labs!',
      improve: 'More NPCs',
      name: 'Sam',
      email: 'Sam@Example.com',
    });
    expect(res.status).toBe(201);

    const saved = await Feedback.findOne();
    expect(saved.rating).toBe(5);
    expect(saved.visitorType).toBe('prospective_student');
    expect(saved.platform).toBe('vr');
    expect(saved.email).toBe('sam@example.com');
    expect(saved.source).toBe('website');
  });

  test('rating, name and email are enough - the other questions are optional', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({ rating: '3', name: 'Ann', email: 'ann@example.com', visitorType: '', platform: '' });
    expect(res.status).toBe(201);
    const saved = await Feedback.findOne();
    expect(saved.rating).toBe(3);
    expect(saved.visitorType).toBeUndefined();
  });

  const CONTACT = { name: 'Ann', email: 'ann@example.com' };

  test.each([
    ['missing rating', { ...CONTACT }],
    ['rating out of range', { ...CONTACT, rating: 9 }],
    ['missing name', { rating: 4, email: 'ann@example.com' }],
    ['blank name', { rating: 4, name: '   ', email: 'ann@example.com' }],
    ['missing email', { rating: 4, name: 'Ann' }],
    ['bad email', { rating: 4, name: 'Ann', email: 'not-an-email' }],
    ['unknown visitor type', { ...CONTACT, rating: 4, visitorType: 'robot' }],
    ['unknown platform', { ...CONTACT, rating: 4, platform: 'ios' }],
    ['answer too long', { ...CONTACT, rating: 4, liked: 'x'.repeat(1001) }],
  ])('rejects %s', async (_label, payload) => {
    const res = await request(app).post('/api/feedback').send(payload);
    expect(res.status).toBe(400);
    expect(await Feedback.countDocuments()).toBe(0);
  });

  test('honeypot: bots get a success response but nothing is stored', async () => {
    const res = await request(app).post('/api/feedback').send({ ...CONTACT, rating: 5, website: 'http://spam.example' });
    expect(res.status).toBe(201);
    expect(await Feedback.countDocuments()).toBe(0);
  });

  test('admins can list feedback, newest first', async () => {
    await Feedback.create({ ...CONTACT, rating: 2, createdAt: new Date('2026-01-01') });
    await Feedback.create({ ...CONTACT, rating: 5, createdAt: new Date('2026-02-01') });

    const res = await request(app).get('/api/feedback').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.feedback.map((f) => f.rating)).toEqual([5, 2]);
  });

  test('CSV export quotes free text and defuses spreadsheet formulas', async () => {
    await Feedback.create({ ...CONTACT, rating: 4, liked: 'Great, "really" good', improve: '=HYPERLINK("x")' });

    const res = await request(app)
      .get('/api/export/feedback')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/csv/);
    expect(res.text).toContain('"Great, ""really"" good"');
    expect(res.text).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
