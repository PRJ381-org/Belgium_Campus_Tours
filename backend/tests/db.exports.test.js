/**
 * CSV exports and the Reports page counts against a real MongoDB:
 * the timeframe filter, the new tickets export, and filenames.
 */
const request = require('supertest');
const app = require('../src/app');
const Lead = require('../src/models/Lead');
const AnalyticsEvent = require('../src/models/AnalyticsEvent');
const Feedback = require('../src/models/Feedback');
const Ticket = require('../src/models/Ticket');
const { signSessionToken } = require('../src/utils/jwt');
const { describeDb, connect, disconnect, clear } = require('./helpers/db');

const adminToken = signSessionToken({ _id: 'a1', email: 'a@bc.ac.za', role: 'admin', name: 'A' });
const get = (path) => request(app).get(path).set('Authorization', `Bearer ${adminToken}`);

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

describeDb('exports (database-backed)', () => {
  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(async () => {
    await clear();
    // One recent and one old record of each kind.
    await Lead.create([
      { email: 'new@example.com', source: 'end_screen', createdAt: daysAgo(1) },
      { email: 'old@example.com', source: 'end_screen', createdAt: daysAgo(40) },
    ]);
    await AnalyticsEvent.create([
      { sessionId: 's-new', eventType: 'session_start', createdAt: daysAgo(1) },
      { sessionId: 's-old', eventType: 'session_start', createdAt: daysAgo(40) },
    ]);
    await Feedback.create([
      { rating: 5, name: 'N', email: 'n@example.com', createdAt: daysAgo(1) },
      { rating: 3, name: 'O', email: 'o@example.com', createdAt: daysAgo(40) },
    ]);
    const ticket = new Ticket({
      ref: 'VC-ABCD23',
      keyHashes: [Ticket.hashKey('k')],
      name: 'Sam',
      email: 'sam@example.com',
      category: 'download',
      subject: 'APK, "quoted", issue',
    });
    ticket.addMessage('visitor', 'It will not install');
    ticket.addMessage('staff', 'Try again', 'Hana');
    await ticket.save();
  });

  test('counts respect the timeframe', async () => {
    const all = await get('/api/export/counts');
    expect(all.body.counts).toEqual({ leads: 2, events: 2, sessions: 2, feedback: 2, tickets: 1 });

    const week = await get('/api/export/counts?timeframe=7d');
    expect(week.body.counts).toEqual({ leads: 1, events: 1, sessions: 1, feedback: 1, tickets: 1 });
  });

  test('an unknown timeframe falls back to all time', async () => {
    const res = await get('/api/export/counts?timeframe=forever');
    expect(res.body.timeframe).toBe('all');
    expect(res.body.counts.leads).toBe(2);
  });

  test('leads export filters by timeframe and names the file after it', async () => {
    const res = await get('/api/export/leads?timeframe=7d');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/belgium_campus_leads_7d_\d{4}-\d{2}-\d{2}\.csv/);
    expect(res.text).toContain('# Period: Last 7 days');
    expect(res.text).toContain('new@example.com');
    expect(res.text).not.toContain('old@example.com');
  });

  test('summary export counts only the chosen period', async () => {
    const res = await get('/api/export/summary?timeframe=30d');
    expect(res.text).toContain('Unique VR Sessions,1,');
    expect(res.text).toContain('Total Student Leads,1,');
  });

  test('tickets export has one row per ticket with safe quoting', async () => {
    const res = await get('/api/export/tickets');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/csv/);
    const row = res.text.split('\n').find((l) => l.startsWith('"VC-ABCD23"'));
    expect(row).toContain('"APK, ""quoted"", issue"');
    expect(row).toContain(',2,1,'); // 2 messages, 1 staff reply
    expect(res.text).not.toContain(Ticket.hashKey('k')); // never leak key hashes
  });
});
