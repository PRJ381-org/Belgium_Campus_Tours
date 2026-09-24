/**
 * Support tickets against a real MongoDB.
 *
 * Visitors have no accounts - a random per-browser key is the only thing that
 * lets them see a ticket - so most of these pin who can see what.
 */
const request = require('supertest');
const app = require('../src/app');
const Ticket = require('../src/models/Ticket');
const { signSessionToken } = require('../src/utils/jwt');
const { describeDb, connect, disconnect, clear } = require('./helpers/db');

const adminToken = signSessionToken({ _id: 'a1', email: 'helpdesk@bc.ac.za', role: 'admin', name: 'Helpdesk Hana' });
const asAdmin = (req) => req.set('Authorization', `Bearer ${adminToken}`);

const NEW_TICKET = {
  name: 'Sam',
  email: 'Sam@Example.com',
  category: 'download',
  platform: 'android',
  subject: 'APK will not install',
  message: 'It says the package is invalid.',
};

async function open(overrides = {}) {
  const res = await request(app).post('/api/tickets').send({ ...NEW_TICKET, ...overrides });
  expect(res.status).toBe(201);
  return res.body; // { ref, key, ticket }
}

describeDb('support tickets (database-backed)', () => {
  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(clear);

  test('creating a ticket returns a readable ref and a private key', async () => {
    const { ref, key, ticket } = await open();
    expect(ref).toMatch(/^VC-[A-Z0-9]{6}$/);
    expect(key).toHaveLength(48);
    expect(ticket.status).toBe('open');
    expect(ticket.messages).toHaveLength(1);
    expect(ticket.email).toBe('sam@example.com');
    expect(ticket.keyHashes).toBeUndefined();

    // Only a hash of the key is stored, never the key itself.
    const stored = await Ticket.findOne({ ref }).select('+keyHashes');
    expect(stored.keyHashes).toEqual([Ticket.hashKey(key)]);
    expect(JSON.stringify(stored)).not.toContain(key);
  });

  test.each([
    ['missing name', { name: '' }],
    ['bad email', { email: 'nope' }],
    ['unknown category', { category: 'refund' }],
    ['empty message', { message: '   ' }],
    ['subject too long', { subject: 'x'.repeat(121) }],
  ])('rejects %s', async (_label, overrides) => {
    const res = await request(app).post('/api/tickets').send({ ...NEW_TICKET, ...overrides });
    expect(res.status).toBe(400);
    expect(await Ticket.countDocuments()).toBe(0);
  });

  test('honeypot: bots get a success response but nothing is stored', async () => {
    const res = await request(app).post('/api/tickets').send({ ...NEW_TICKET, website: 'spam' });
    expect(res.status).toBe(201);
    expect(await Ticket.countDocuments()).toBe(0);
  });

  test('"mine" only returns tickets whose key matches', async () => {
    const a = await open();
    const b = await open({ subject: 'Another one' });

    const res = await request(app)
      .post('/api/tickets/mine')
      .send({ tickets: [{ ref: a.ref, key: a.key }, { ref: b.ref, key: 'wrong-key' }] });
    expect(res.status).toBe(200);
    expect(res.body.tickets.map((t) => t.ref)).toEqual([a.ref]);
  });

  test('visitor replies need the right key, and reopen a resolved ticket', async () => {
    const { ref, key } = await open();
    await Ticket.updateOne({ ref }, { status: 'resolved' });

    const wrong = await request(app).post(`/api/tickets/${ref}/messages`).send({ key: 'nope', message: 'hi' });
    expect(wrong.status).toBe(404);

    const ok = await request(app).post(`/api/tickets/${ref}/messages`).send({ key, message: 'Still broken' });
    expect(ok.status).toBe(200);
    expect(ok.body.ticket.status).toBe('open');
    expect(ok.body.ticket.messages).toHaveLength(2);
    expect(ok.body.ticket.lastMessageBy).toBe('visitor');
  });

  test('lookup needs BOTH ref and email, and hands the new browser its own key', async () => {
    const { ref, key } = await open();

    const wrongEmail = await request(app).post('/api/tickets/lookup').send({ ref, email: 'someone@else.com' });
    expect(wrongEmail.status).toBe(404);

    const found = await request(app).post('/api/tickets/lookup').send({ ref: ref.toLowerCase(), email: 'sam@example.com' });
    expect(found.status).toBe(200);
    expect(found.body.key).not.toBe(key);

    // Both the old and the new browser keep working.
    const mine = await request(app)
      .post('/api/tickets/mine')
      .send({ tickets: [{ ref, key }, { ref, key: found.body.key }] });
    expect(mine.body.tickets).toHaveLength(2);
  });

  test('staff reply moves it to in progress and the visitor sees it', async () => {
    const { ref, key } = await open();

    const reply = await asAdmin(request(app).post(`/api/tickets/${ref}/reply`)).send({ message: 'Try re-downloading it.' });
    expect(reply.status).toBe(200);

    const mine = await request(app).post('/api/tickets/mine').send({ tickets: [{ ref, key }] });
    const [ticket] = mine.body.tickets;
    expect(ticket.status).toBe('in_progress');
    expect(ticket.lastMessageBy).toBe('staff');
    expect(ticket.messages[1]).toMatchObject({ author: 'staff', staffName: 'Helpdesk Hana', body: 'Try re-downloading it.' });
  });

  test('staff can list, count and change status - without ever seeing key hashes', async () => {
    const { ref } = await open();

    const list = await asAdmin(request(app).get('/api/tickets'));
    expect(list.status).toBe(200);
    expect(list.body.tickets[0].ref).toBe(ref);
    expect(list.body.tickets[0].keyHashes).toBeUndefined();

    const stats = await asAdmin(request(app).get('/api/tickets/stats'));
    expect(stats.body).toMatchObject({ open: 1, needsReply: 1 });

    const done = await asAdmin(request(app).patch(`/api/tickets/${ref}/status`)).send({ status: 'resolved' });
    expect(done.body.ticket.status).toBe('resolved');

    const bad = await asAdmin(request(app).patch(`/api/tickets/${ref}/status`)).send({ status: 'deleted' });
    expect(bad.status).toBe(400);
  });
});
