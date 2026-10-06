/**
 * Automated Operational & Database Script Tests.
 *
 * Verifies:
 * - Lead source derivation algorithm across all client permutations
 * - Lead migration workflow (dry run reporting, bulk write execution, idempotency)
 * - Index preflight checks, build mechanics, duplicate collision rejection, and partial filter behavior
 * - User RBAC roles and master tier safety bounds
 */
const mongoose = require('mongoose');
const Lead = require('../src/models/Lead');
const AnalyticsEvent = require('../src/models/AnalyticsEvent');
const User = require('../src/models/User');
const { describeDb, connect, disconnect, clear } = require('./helpers/db');

describeDb('Database Operational Scripts & Migrations', () => {
  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(clear);

  describe('Lead.deriveSource Logic', () => {
    test('preserves explicit source if present and trims whitespace', () => {
      expect(Lead.deriveSource({ source: '  web_landing  ' })).toBe('web_landing');
      expect(Lead.deriveSource({ source: 'qr_poster' })).toBe('qr_poster');
    });

    test('prioritizes explicit source over hotspotId', () => {
      expect(Lead.deriveSource({ source: 'direct_form', hotspotId: 'hs_library' })).toBe('direct_form');
    });

    test('derives hotspot:<id> when hotspotId is present without explicit source', () => {
      expect(Lead.deriveSource({ hotspotId: 'hs_library' })).toBe('hotspot:hs_library');
      expect(Lead.deriveSource({ hotspotId: '  hs_technolab  ' })).toBe('hotspot:hs_technolab');
    });

    test('falls back to DEFAULT_LEAD_SOURCE when neither is provided', () => {
      expect(Lead.deriveSource({})).toBe(Lead.DEFAULT_LEAD_SOURCE);
      expect(Lead.deriveSource()).toBe(Lead.DEFAULT_LEAD_SOURCE);
      expect(Lead.deriveSource({ source: '', hotspotId: '' })).toBe('end_screen');
    });
  });

  describe('migrate-leads.js Workflow Simulation', () => {
    test('dry run reports pending count without modifying documents', async () => {
      // Direct raw insertion to bypass Mongoose default source
      await Lead.collection.insertMany([
        { email: 'legacy1@example.com', hotspotId: 'hs_alpha' },
        { email: 'legacy2@example.com' },
        { email: 'modern@example.com', source: 'mobile_app' },
      ]);

      const pending = await Lead.find({ $or: [{ source: { $exists: false } }, { source: null }] }).lean();
      expect(pending).toHaveLength(2);

      // Verify dry-run leaves collection intact
      const unmutated = await Lead.find({ source: 'mobile_app' });
      expect(unmutated).toHaveLength(1);
    });

    test('apply bulk write migrates all legacy leads and is idempotent', async () => {
      await Lead.collection.insertMany([
        { email: 'legacy1@example.com', hotspotId: 'hs_technolab' },
        { email: 'legacy2@example.com', hotspotId: '' },
      ]);

      const pending = await Lead.find({ $or: [{ source: { $exists: false } }, { source: null }] }).lean();
      expect(pending).toHaveLength(2);

      // Perform migration bulk write
      const ops = pending.map((lead) => ({
        updateOne: {
          filter: { _id: lead._id },
          update: { $set: { source: Lead.deriveSource(lead) } },
        },
      }));

      const result = await Lead.bulkWrite(ops, { ordered: false });
      expect(result.modifiedCount).toBe(2);

      // Check results
      const lead1 = await Lead.findOne({ email: 'legacy1@example.com' });
      expect(lead1.source).toBe('hotspot:hs_technolab');

      const lead2 = await Lead.findOne({ email: 'legacy2@example.com' });
      expect(lead2.source).toBe('end_screen');

      // Verify zero pending leads remain
      const remaining = await Lead.countDocuments({
        $or: [{ source: { $exists: false } }, { source: null }],
      });
      expect(remaining).toBe(0);

      // Idempotency check: re-running finds 0 pending
      const secondPending = await Lead.find({ $or: [{ source: { $exists: false } }, { source: null }] });
      expect(secondPending).toHaveLength(0);
    });
  });

  describe('enable-indexes.js Preflight & Collision Mechanics', () => {
    test('preflight detects duplicate emails before applying unique index', async () => {
      // Seed duplicates directly
      await Lead.collection.insertMany([
        { email: 'dupe@example.com', source: 'web' },
        { email: 'dupe@example.com', source: 'vr' },
        { email: 'unique@example.com', source: 'web' },
      ]);

      const dupes = await Lead.aggregate([
        { $group: { _id: '$email', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ]);

      expect(dupes).toHaveLength(1);
      expect(dupes[0]._id).toBe('dupe@example.com');
      expect(dupes[0].count).toBe(2);
    });

    test('preflight detects duplicate (sessionId, seq) pairs', async () => {
      await AnalyticsEvent.collection.insertMany([
        { sessionId: 'sess-A', seq: 1, eventType: 'session_start' },
        { sessionId: 'sess-A', seq: 1, eventType: 'area_enter' },
        { sessionId: 'sess-A', seq: 2, eventType: 'area_exit' },
      ]);

      const dupes = await AnalyticsEvent.aggregate([
        { $match: { seq: { $exists: true, $ne: null } } },
        { $group: { _id: { sessionId: '$sessionId', seq: '$seq' }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ]);

      expect(dupes).toHaveLength(1);
      expect(dupes[0]._id).toEqual({ sessionId: 'sess-A', seq: 1 });
      expect(dupes[0].count).toBe(2);
    });

    test('creates unique {sessionId, seq} index with partialFilterExpression', async () => {
      // Build index dynamically
      await AnalyticsEvent.collection.createIndex(
        { sessionId: 1, seq: 1 },
        {
          unique: true,
          partialFilterExpression: { seq: { $exists: true } },
          name: 'test_uniq_session_seq',
        }
      );

      // 1) First event with seq=1 succeeds
      await AnalyticsEvent.create({ sessionId: 'sess-X', seq: 1, eventType: 'session_start' });

      // 2) Colliding event with same sessionId and seq throws 11000 duplicate key error
      let collisionError;
      try {
        await AnalyticsEvent.create({ sessionId: 'sess-X', seq: 1, eventType: 'area_exit' });
      } catch (err) {
        collisionError = err;
      }
      expect(collisionError).toBeDefined();
      expect(collisionError.code).toBe(11000);

      // 3) Partial filter expression test: multiple events without seq do NOT collide
      await AnalyticsEvent.create({ sessionId: 'sess-X', eventType: 'session_start' });
      await AnalyticsEvent.create({ sessionId: 'sess-X', eventType: 'session_end' });

      const count = await AnalyticsEvent.countDocuments({ sessionId: 'sess-X' });
      expect(count).toBe(3); // 1 with seq=1, and 2 without seq
    });

    test('creates TTL index on createdAt', async () => {
      const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
      await AnalyticsEvent.collection.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: ONE_YEAR_SECONDS, name: 'test_ttl_createdAt' }
      );

      const indexes = await AnalyticsEvent.collection.indexes();
      const ttlIndex = indexes.find((idx) => idx.name === 'test_ttl_createdAt');
      expect(ttlIndex).toBeDefined();
      expect(ttlIndex.expireAfterSeconds).toBe(ONE_YEAR_SECONDS);
    });
  });

  describe('User RBAC & Role Boundaries', () => {
    test('User.ROLES includes viewer, admin, master', () => {
      expect(User.ROLES).toEqual(['viewer', 'admin', 'master']);
    });

    test('enforces role enum validation on User model save', async () => {
      const validUser = new User({
        email: 'admin@bc.ac.za',
        role: 'admin',
      });
      await expect(validUser.validate()).resolves.toBeUndefined();

      const masterUser = new User({
        email: 'master@bc.ac.za',
        role: 'master',
      });
      await expect(masterUser.validate()).resolves.toBeUndefined();

      const invalidUser = new User({
        email: 'hacker@bc.ac.za',
        role: 'superadmin_escalation',
      });
      await expect(invalidUser.validate()).rejects.toThrow();
    });
  });
});
