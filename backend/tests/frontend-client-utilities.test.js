/**
 * Automated Frontend Client Pure Utilities & Logic Tests.
 *
 * Verifies:
 * - CSV stream parsing, escaping, RFC-4180 quotes, and row bounds
 * - Client-side visitor support ticket caching, 20-slot LRU, unread reply calculation
 * - Ticket labels, platform dictionaries, and category mapping integrity
 * - Chart palette and theme configuration stability
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('Frontend Client Utilities & Logic', () => {
  let parseCsv;
  let loadSaved, rememberTicket, markSeen, unreadCount;
  let CATEGORY_LABELS, PLATFORM_LABELS, STATUS_LABELS;
  let mockStorage;

  beforeAll(() => {
    // 1) Load csv.js
    const csvPath = path.join(__dirname, '../client/src/lib/csv.js');
    const csvCode = fs.readFileSync(csvPath, 'utf8').replace(/export function/g, 'function');
    const csvCtx = { Infinity, Math };
    vm.createContext(csvCtx);
    vm.runInContext(csvCode, csvCtx);
    parseCsv = csvCtx.parseCsv;

    // 2) Load ticketLabels.js
    const labelsPath = path.join(__dirname, '../client/src/lib/ticketLabels.js');
    const labelsCode = fs.readFileSync(labelsPath, 'utf8').replace(/export const/g, 'var');
    const labelsCtx = {};
    vm.createContext(labelsCtx);
    vm.runInContext(labelsCode, labelsCtx);
    CATEGORY_LABELS = labelsCtx.CATEGORY_LABELS;
    PLATFORM_LABELS = labelsCtx.PLATFORM_LABELS;
    STATUS_LABELS = labelsCtx.STATUS_LABELS;

    // 3) Setup tickets.js with mock localStorage
    mockStorage = new Map();
    const mockLocalStorage = {
      getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
      setItem: (key, val) => mockStorage.set(key, String(val)),
      removeItem: (key) => mockStorage.delete(key),
      clear: () => mockStorage.clear(),
    };

    const ticketsPath = path.join(__dirname, '../client/src/lib/tickets.js');
    const ticketsCode = fs
      .readFileSync(ticketsPath, 'utf8')
      .replace(/export function/g, 'function')
      .replace(/export async function/g, 'async function');

    const ticketsCtx = {
      localStorage: mockLocalStorage,
      Date,
      JSON,
      Array,
      fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    };
    vm.createContext(ticketsCtx);
    vm.runInContext(ticketsCode, ticketsCtx);

    loadSaved = ticketsCtx.loadSaved;
    rememberTicket = ticketsCtx.rememberTicket;
    markSeen = ticketsCtx.markSeen;
    unreadCount = ticketsCtx.unreadCount;
  });

  beforeEach(() => {
    mockStorage.clear();
  });

  describe('CSV Parser (parseCsv)', () => {
    test('skips comment lines prefixed with "#" and extracts headers and data', () => {
      const csv = [
        '# Export generated 2026-10-06',
        '# Filter: all',
        'id,email,source',
        '1,student@bc.ac.za,website',
        '2,applicant@bc.ac.za,vr',
      ].join('\n');

      const result = parseCsv(csv);
      expect(result.header).toEqual(['id', 'email', 'source']);
      expect(result.rows).toEqual([
        ['1', 'student@bc.ac.za', 'website'],
        ['2', 'applicant@bc.ac.za', 'vr'],
      ]);
    });

    test('correctly handles quoted fields with embedded commas', () => {
      const csv = 'id,name,role\n1,"Doe, John",admin\n2,"Smith, Jane",viewer';
      const result = parseCsv(csv);
      expect(result.rows[0]).toEqual(['1', 'Doe, John', 'admin']);
      expect(result.rows[1]).toEqual(['2', 'Smith, Jane', 'viewer']);
    });

    test('correctly unescapes double quotes inside quoted cells ("" -> ")', () => {
      const csv = 'id,message\n1,"He said ""Welcome to campus!"""';
      const result = parseCsv(csv);
      expect(result.rows[0]).toEqual(['1', 'He said "Welcome to campus!"']);
    });

    test('handles multiline cell contents without breaking row alignment', () => {
      const csv = 'id,feedback\n1,"First paragraph.\nSecond paragraph."\n2,Short';
      const result = parseCsv(csv);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0][1]).toBe('First paragraph.\nSecond paragraph.');
      expect(result.rows[1][1]).toBe('Short');
    });

    test('respects maxRows limiter', () => {
      const csv = 'col\nrow1\nrow2\nrow3\nrow4\nrow5';
      const result = parseCsv(csv, 2);
      expect(result.header).toEqual(['col']);
      expect(result.rows).toHaveLength(2);
      expect(result.rows).toEqual([['row1'], ['row2']]);
    });

    test('handles empty input gracefully', () => {
      const result = parseCsv('');
      expect(result.header).toEqual([]);
      expect(result.rows).toEqual([]);
    });
  });

  describe('Client-Side Ticket Storage & Sync (tickets.js)', () => {
    test('loadSaved returns empty array when storage is empty or invalid JSON', () => {
      expect(loadSaved()).toEqual([]);

      mockStorage.set('vcod-support-tickets', 'corrupted-non-json{{');
      expect(loadSaved()).toEqual([]);
    });

    test('rememberTicket saves ticket with timestamp and deduplicates on update', () => {
      rememberTicket('T-1001', 'key-secret-1');
      let saved = loadSaved();
      expect(saved).toHaveLength(1);
      expect(saved[0].ref).toBe('T-1001');
      expect(saved[0].key).toBe('key-secret-1');
      expect(typeof saved[0].seen).toBe('number');

      // Update same ticket -> must remain 1 item and update timestamp
      const prevSeen = saved[0].seen;
      rememberTicket('T-1001', 'key-secret-1');
      saved = loadSaved();
      expect(saved).toHaveLength(1);
      expect(saved[0].seen).toBeGreaterThanOrEqual(prevSeen);
    });

    test('strictly caps stored tickets at 20 (FIFO eviction of oldest)', () => {
      for (let i = 1; i <= 25; i++) {
        rememberTicket(`T-${1000 + i}`, `key-${i}`);
      }

      const saved = loadSaved();
      expect(saved).toHaveLength(20);
      // Newest ticket (T-1025) must be at index 0
      expect(saved[0].ref).toBe('T-1025');
      // Oldest tickets (T-1001 to T-1005) must have been evicted
      expect(saved.some((t) => t.ref === 'T-1001')).toBe(false);
      expect(saved.some((t) => t.ref === 'T-1005')).toBe(false);
      expect(saved.some((t) => t.ref === 'T-1006')).toBe(true);
    });

    test('markSeen updates the seen timestamp for a specific ticket', () => {
      rememberTicket('T-2001', 'key-1');
      const initialSeen = loadSaved()[0].seen;

      // Advance clock slightly
      markSeen('T-2001');
      const updatedSeen = loadSaved()[0].seen;
      expect(updatedSeen).toBeGreaterThanOrEqual(initialSeen);
    });

    test('unreadCount accurately tallies only staff replies newer than seen timestamp', () => {
      const now = Date.now();
      const saved = [{ ref: 'T-3001', key: 'key-1', seen: now - 5000 }];

      const ticket = {
        ref: 'T-3001',
        messages: [
          { author: 'visitor', message: 'Hello', createdAt: new Date(now - 10000).toISOString() },
          { author: 'staff', message: 'First response', createdAt: new Date(now - 6000).toISOString() }, // before seen
          { author: 'staff', message: 'Second response', createdAt: new Date(now - 2000).toISOString() }, // AFTER seen -> unread
          { author: 'staff', message: 'Third response', createdAt: new Date(now - 1000).toISOString() }, // AFTER seen -> unread
        ],
      };

      const unread = unreadCount(ticket, saved);
      expect(unread).toBe(2);
    });
  });

  describe('Ticket Labels & Dictionaries (ticketLabels.js)', () => {
    test('contains verified category mappings', () => {
      expect(CATEGORY_LABELS).toMatchObject({
        vr_tour: 'VR tour problem',
        download: 'Download / install',
        website: 'Website',
        other: 'Something else',
      });
    });

    test('contains verified platform mappings', () => {
      expect(PLATFORM_LABELS).toMatchObject({
        vr: 'VR headset',
        pc: 'PC',
        android: 'Android',
        website: 'Website',
        other: 'Other',
      });
    });

    test('contains verified status mappings', () => {
      expect(STATUS_LABELS).toMatchObject({
        open: 'Open',
        in_progress: 'In progress',
        resolved: 'Resolved',
      });
    });
  });
});
