/**
 * Full Application End-to-End (E2E) Integration Test Suite.
 *
 * Covers ClickUp Ticket 7: "Full application test (bug-free experience)"
 * Validates the complete multi-tier data lifecycle:
 * Visitor Web/Game Interaction -> Analytics Telemetry -> Lead Intake ->
 * Support Helpdesk -> Admin Dashboard Consumption -> CSV Data Export.
 */
const request = require('supertest');
const app = require('../src/app');
const Lead = require('../src/models/Lead');
const Ticket = require('../src/models/Ticket');
const Feedback = require('../src/models/Feedback');
const AnalyticsEvent = require('../src/models/AnalyticsEvent');
const { signSessionToken } = require('../src/utils/jwt');
const { describeDb, connect, disconnect, clear } = require('./helpers/db');

describeDb('Ticket 7: Full Application E2E Integration Pipeline', () => {
  const adminToken = signSessionToken({
    _id: 'admin_e2e_1',
    email: 'coordinator@belgiumcampus.ac.za',
    name: 'Open Day Admin',
    role: 'admin',
  });

  const testSessionId = 'sess_e2e_prospective_student_101';
  let createdTicketRef = null;
  let visitorAccessKey = null;

  beforeAll(async () => {
    await connect();
  });

  afterAll(async () => {
    await disconnect();
  });

  beforeEach(async () => {
    await clear();
  });

  // -------------------------------------------------------------------------
  // PHASE 1: VISITOR PUBLIC JOURNEY (WEB PORTAL + GAME CLIENT SIMULATION)
  // -------------------------------------------------------------------------

  test('STEP 1: Visitor loads web landing page and checks download metadata', async () => {
    // 1.1 Web Landing HTML
    const landingRes = await request(app).get('/');
    expect(landingRes.status).toBe(200);
    expect(landingRes.headers['content-type']).toMatch(/html/);

    // 1.2 Download Metadata API
    const infoRes = await request(app).get('/api/downloads/info');
    expect(infoRes.status).toBe(200);
    expect(infoRes.body.success).toBe(true);
    expect(infoRes.body.platforms).toHaveProperty('windows');
    expect(infoRes.body.platforms).toHaveProperty('android');
    expect(infoRes.body.platforms).toHaveProperty('quest');
  });

  test('STEP 2: Visitor downloads Windows build, triggering telemetry redirect', async () => {
    const dlRes = await request(app)
      .get(`/api/downloads/windows?sessionId=${testSessionId}`);

    // Download issues a 302 Redirect to CDN/Releases
    expect(dlRes.status).toBe(302);
    expect(dlRes.headers.location).toMatch(/PRJ381-Windows/);

    // Wait a brief moment for non-blocking telemetry background write to complete
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Verify telemetry event was stored in MongoDB
    const dlEvent = await AnalyticsEvent.findOne({
      sessionId: testSessionId,
      eventType: 'game_download',
    });
    expect(dlEvent).not.toBeNull();
    expect(dlEvent.hotspotId).toBe('windows_build');
  });

  test('STEP 3: Visitor tours campus in game client, generating analytics stream', async () => {
    // 3.1 Session Start
    const startRes = await request(app)
      .post('/api/analytics/events')
      .send({
        sessionId: testSessionId,
        eventType: 'session_start',
        seq: 1,
      });
    expect(startRes.status).toBe(201);

    // 3.2 Enter TechnoLab
    const enterRes = await request(app)
      .post('/api/analytics/events')
      .send({
        sessionId: testSessionId,
        eventType: 'area_enter',
        area: 'TechnoLab',
        seq: 2,
      });
    expect(enterRes.status).toBe(201);

    // 3.3 Inspect Melanie NPC Hotspot
    const hsRes = await request(app)
      .post('/api/analytics/events')
      .send({
        sessionId: testSessionId,
        eventType: 'hotspot_view',
        area: 'TechnoLab',
        hotspotId: 'hs_melanie_datascience',
        seq: 3,
      });
    expect(hsRes.status).toBe(201);

    // 3.4 Exit TechnoLab with duration
    const exitRes = await request(app)
      .post('/api/analytics/events')
      .send({
        sessionId: testSessionId,
        eventType: 'area_exit',
        area: 'TechnoLab',
        durationMs: 45000,
        seq: 4,
      });
    expect(exitRes.status).toBe(201);

    // Verify all 4 sequential events exist in DB
    const eventCount = await AnalyticsEvent.countDocuments({ sessionId: testSessionId });
    expect(eventCount).toBe(4);
  });

  test('STEP 4: Visitor submits in-game "Request More Information" lead form', async () => {
    const leadEmail = 'prospective.student@belgiumcampus.ac.za';
    const leadRes = await request(app)
      .post('/api/leads')
      .send({
        email: leadEmail,
        hotspotId: 'hs_melanie_datascience',
        sessionId: testSessionId,
      });

    expect(leadRes.status).toBe(201);
    expect(leadRes.body.success).toBe(true);
    expect(leadRes.body.source).toBe('hotspot:hs_melanie_datascience');

    // Confirm lead in MongoDB
    const storedLead = await Lead.findOne({ email: leadEmail });
    expect(storedLead).not.toBeNull();
    expect(storedLead.sessionId).toBe(testSessionId);
    expect(storedLead.hotspotId).toBe('hs_melanie_datascience');
  });

  test('STEP 5: Visitor submits feedback on web landing page', async () => {
    const feedbackRes = await request(app)
      .post('/api/feedback')
      .send({
        rating: 5,
        visitorType: 'prospective_student',
        platform: 'pc',
        liked: 'The 3D photogrammetry of the TechnoLab is incredible!',
        improve: 'Would love to see the cafeteria menu in 3D.',
        name: 'Alex Visitor',
        email: 'alex.visitor@example.com',
        website: '', // honeypot left empty by real user
      });

    expect(feedbackRes.status).toBe(201);
    expect(feedbackRes.body.success).toBe(true);

    const storedFb = await Feedback.findOne({ email: 'alex.visitor@example.com' });
    expect(storedFb).not.toBeNull();
    expect(storedFb.rating).toBe(5);
    expect(storedFb.visitorType).toBe('prospective_student');
  });

  test('STEP 6: Visitor opens support ticket and exchanges replies with staff', async () => {
    // 6.1 Create Ticket
    const createRes = await request(app)
      .post('/api/tickets')
      .send({
        name: 'Alex Visitor',
        email: 'alex.visitor@example.com',
        category: 'vr_tour',
        platform: 'pc',
        subject: 'Graphics driver requirement',
        message: 'Does the desktop build require DirectX 12 or will DX11 work?',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.ref).toMatch(/^VC-[A-Z0-9]{6}$/);
    createdTicketRef = createRes.body.ref;
    visitorAccessKey = createRes.body.key;

    // 6.2 Visitor queries ticket status via lookup
    const lookupRes = await request(app)
      .post('/api/tickets/lookup')
      .send({
        ref: createdTicketRef,
        email: 'alex.visitor@example.com',
      });
    expect(lookupRes.status).toBe(200);
    expect(lookupRes.body.ticket.subject).toBe('Graphics driver requirement');

    // 6.3 Visitor adds follow-up reply
    const replyRes = await request(app)
      .post(`/api/tickets/${createdTicketRef}/messages`)
      .send({
        key: visitorAccessKey,
        message: 'Also, does it support ultrawide monitors?',
      });
    expect(replyRes.status).toBe(200);
    expect(replyRes.body.ticket.messages.length).toBe(2);
    expect(replyRes.body.ticket.lastMessageBy).toBe('visitor');
  });

  // -------------------------------------------------------------------------
  // PHASE 2: ADMIN CONSUMPTION & DATA EXPORT (DASHBOARD WORKFLOW)
  // -------------------------------------------------------------------------

  test('STEP 7: Admin views analytics summary, verifying aggregated visitor data', async () => {
    // Seed prerequisite telemetry
    await AnalyticsEvent.create([
      { sessionId: testSessionId, eventType: 'session_start', seq: 1 },
      { sessionId: testSessionId, eventType: 'area_enter', area: 'TechnoLab', seq: 2 },
      { sessionId: testSessionId, eventType: 'hotspot_view', area: 'TechnoLab', hotspotId: 'hs_melanie', seq: 3 },
      { sessionId: testSessionId, eventType: 'area_exit', area: 'TechnoLab', durationMs: 30000, seq: 4 },
    ]);

    const summaryRes = await request(app)
      .get('/api/analytics/summary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.success).toBe(true);
    expect(summaryRes.body.uniqueSessions).toBeGreaterThanOrEqual(1);
    expect(summaryRes.body.areas).toHaveProperty('TechnoLab');
    expect(summaryRes.body.hotspots).toHaveProperty('hs_melanie');
    expect(summaryRes.body.avgSessionDurationMs).toBeGreaterThan(0);
  });

  test('STEP 8: Admin answers visitor support ticket from dashboard', async () => {
    // Seed ticket with exact 6-character reference code matching ^VC-[A-Z0-9]{6}$
    const ticket = await Ticket.create({
      ref: 'VC-E2ETST',
      name: 'Test Student',
      email: 'student@example.com',
      category: 'vr_tour',
      subject: 'Inquiry',
      messages: [{ author: 'visitor', body: 'Question here' }],
    });

    const staffReplyRes = await request(app)
      .post(`/api/tickets/${ticket.ref}/reply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        message: 'Hello! PRJ381 requires DirectX 12 for high fidelity desktop rendering.',
      });

    expect(staffReplyRes.status).toBe(200);
    expect(staffReplyRes.body.success).toBe(true);
    expect(staffReplyRes.body.ticket.lastMessageBy).toBe('staff');
    expect(staffReplyRes.body.ticket.messages.length).toBe(2);

    // Update ticket status to resolved
    const statusRes = await request(app)
      .patch(`/api/tickets/${ticket.ref}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'resolved' });

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.ticket.status).toBe('resolved');
  });

  test('STEP 9: Admin exports leads & analytics to CSV for institutional review', async () => {
    // Seed a lead
    await Lead.create({
      email: 'lead_for_export@example.com',
      hotspotId: 'hs_melanie',
      source: 'hotspot:hs_melanie',
      sessionId: 'sess_1',
    });

    // 9.1 Export Leads CSV
    const leadsCsvRes = await request(app)
      .get('/api/export/leads')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(leadsCsvRes.status).toBe(200);
    expect(leadsCsvRes.headers['content-type']).toMatch(/text\/csv/);
    expect(leadsCsvRes.text).toContain('lead_for_export@example.com');
    expect(leadsCsvRes.text).toContain('hotspot:hs_melanie');

    // 9.2 Export Analytics CSV
    const analyticsCsvRes = await request(app)
      .get('/api/export/analytics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(analyticsCsvRes.status).toBe(200);
    expect(analyticsCsvRes.headers['content-type']).toMatch(/text\/csv/);
  });
});
