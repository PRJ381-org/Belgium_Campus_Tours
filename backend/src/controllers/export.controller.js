const asyncHandler = require('../utils/asyncHandler');
const Lead = require('../models/Lead');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const Feedback = require('../models/Feedback');
const Ticket = require('../models/Ticket');
const { LABELS, normalizeTimeframe, timeframeFilter } = require('../utils/timeframe');

/**
 * Helper to format date string for filenames (YYYY-MM-DD)
 */
function getDateString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Quotes a CSV cell: wraps it in quotes, doubles inner quotes, and defuses a
 * leading = + - @ so Excel can't treat a visitor's text as a formula.
 */
function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const iso = (date) => (date ? new Date(date).toISOString() : '');

/** Every export accepts ?timeframe=all|today|24h|7d|30d (default all). */
function period(req) {
  const timeframe = normalizeTimeframe(req.query.timeframe);
  return { timeframe, filter: timeframeFilter(timeframe), label: LABELS[timeframe] };
}

function header(title, { label }, extra = []) {
  return [
    `# Belgium Campus - Virtual Open Day ${title} (Admin Export)`,
    `# Generated at: ${new Date().toISOString()}`,
    `# Period: ${label}`,
    ...extra,
    '',
    '',
  ].join('\n');
}

function sendCsv(res, name, { timeframe }, csv) {
  const suffix = timeframe === 'all' ? '' : `_${timeframe}`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="belgium_campus_${name}${suffix}_${getDateString()}.csv"`);
  res.status(200).send(csv);
}

/**
 * GET /api/export/leads
 * Prospective student leads (Admin only).
 */
exports.exportLeadsCsv = asyncHandler(async (req, res) => {
  const p = period(req);
  const leads = await Lead.find(p.filter).sort({ createdAt: -1 });

  let csv = header('Student Leads', p, [`# Total Records: ${leads.length}`]);
  csv += `Lead ID,Student Email,Source,Session ID,Date & Time (UTC)\n`;
  for (const l of leads) {
    csv += [csvCell(l._id), csvCell(l.email), csvCell(l.source), csvCell(l.sessionId || 'N/A'), csvCell(iso(l.createdAt))].join(',');
    csv += '\n';
  }
  sendCsv(res, 'leads', p, csv);
});

/**
 * GET /api/export/analytics
 * Raw VR telemetry events for Power BI / Excel (Admin only).
 */
exports.exportAnalyticsCsv = asyncHandler(async (req, res) => {
  const p = period(req);
  const limit = Math.min(parseInt(req.query.limit, 10) || 10000, 25000);
  const events = await AnalyticsEvent.find(p.filter).sort({ createdAt: -1 }).limit(limit);

  let csv = header('Telemetry Events', p, [`# Sample Size: ${events.length} records`]);
  csv += `Event ID,Session ID,Event Type,Campus Area,Hotspot ID,Dwell Duration (ms),Sequence Number,Platform,Timestamp (UTC)\n`;
  for (const e of events) {
    csv += [
      csvCell(e._id),
      csvCell(e.sessionId),
      csvCell(e.eventType),
      csvCell(e.area),
      csvCell(e.hotspotId),
      e.durationMs || 0,
      e.seq || 0,
      csvCell(e.platform),
      csvCell(iso(e.createdAt)),
    ].join(',');
    csv += '\n';
  }
  sendCsv(res, 'telemetry', p, csv);
});

/**
 * GET /api/export/summary
 * Executive summary: KPIs, area dwell time and hotspots (Admin only).
 */
exports.exportSummaryCsv = asyncHandler(async (req, res) => {
  const p = period(req);
  const match = Object.keys(p.filter).length ? [{ $match: p.filter }] : [];

  const [totalLeads, totalEvents, sessionIds, byArea, topHotspots, durationStats] = await Promise.all([
    Lead.countDocuments(p.filter),
    AnalyticsEvent.countDocuments(p.filter),
    AnalyticsEvent.distinct('sessionId', p.filter),
    AnalyticsEvent.aggregate([
      ...match,
      { $match: { area: { $exists: true, $ne: null, $ne: '' } } },
      { $group: { _id: '$area', totalDurationMs: { $sum: '$durationMs' }, count: { $sum: 1 } } },
      { $sort: { totalDurationMs: -1 } },
    ]),
    AnalyticsEvent.aggregate([
      ...match,
      { $match: { hotspotId: { $exists: true, $ne: null, $ne: '' } } },
      { $group: { _id: '$hotspotId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    AnalyticsEvent.aggregate([
      ...match,
      { $match: { durationMs: { $gt: 0 } } },
      { $group: { _id: '$sessionId', totalSessionDurationMs: { $sum: '$durationMs' } } },
      { $group: { _id: null, avgDurationMs: { $avg: '$totalSessionDurationMs' } } },
    ]),
  ]);

  const uniqueSessions = sessionIds.length;
  const avgDurationMs = Math.round(durationStats[0]?.avgDurationMs || 0);
  const avgMin = Math.floor(avgDurationMs / 60000);
  const avgSec = Math.round((avgDurationMs % 60000) / 1000);
  const conversionRate = uniqueSessions > 0 ? ((totalLeads / uniqueSessions) * 100).toFixed(1) : '0.0';

  let csv = header('Executive Analytics Report', p);
  csv += `[EXECUTIVE KPI METRICS]\n`;
  csv += `Metric,Value,Description\n`;
  csv += `Unique VR Sessions,${uniqueSessions},Distinct visitors who explored the virtual campus\n`;
  csv += `Total Analytics Events,${totalEvents},Total telemetry interactions logged\n`;
  csv += `Total Student Leads,${totalLeads},Prospective students who submitted info\n`;
  csv += `Conversion Rate,${conversionRate}%,Inquiry to visitor ratio\n`;
  csv += `Avg Session Duration,${avgMin}m ${avgSec}s,Average exploration dwell time per visitor\n\n`;

  csv += `[CAMPUS AREA ENGAGEMENT & DWELL TIME]\n`;
  csv += `Campus Area / Level,Total Dwell Time (Seconds),Interaction Count\n`;
  if (byArea.length === 0) csv += `No area data recorded yet,0,0\n`;
  for (const a of byArea) csv += `${csvCell(a._id)},${Math.round((a.totalDurationMs || 0) / 1000)},${a.count}\n`;
  csv += `\n`;

  csv += `[TOP VISITED HOTSPOTS & KIOSKS]\n`;
  csv += `Hotspot Identifier,Total Views / Interactions\n`;
  if (topHotspots.length === 0) csv += `No hotspot data recorded yet,0\n`;
  for (const h of topHotspots) csv += `${csvCell(h._id)},${h.count}\n`;

  sendCsv(res, 'executive_summary', p, csv);
});

/**
 * GET /api/export/feedback
 * Open Day feedback form responses (Admin only).
 */
exports.exportFeedbackCsv = asyncHandler(async (req, res) => {
  const p = period(req);
  const feedback = await Feedback.find(p.filter).sort({ createdAt: -1 });

  let csv = header('Feedback', p, [`# Total Responses: ${feedback.length}`]);
  csv += `Date & Time (UTC),Rating,Visitor Type,Platform,What They Liked,What Could Improve,Name,Email,Source\n`;
  for (const f of feedback) {
    csv += [
      csvCell(iso(f.createdAt)),
      f.rating,
      csvCell(f.visitorType),
      csvCell(f.platform),
      csvCell(f.liked),
      csvCell(f.improve),
      csvCell(f.name),
      csvCell(f.email),
      csvCell(f.source),
    ].join(',');
    csv += '\n';
  }
  sendCsv(res, 'feedback', p, csv);
});

/**
 * GET /api/export/tickets
 * Support tickets from the landing page widget (Admin only).
 */
exports.exportTicketsCsv = asyncHandler(async (req, res) => {
  const p = period(req);
  const tickets = await Ticket.find(p.filter).sort({ createdAt: -1 });

  let csv = header('Support Tickets', p, [`# Total Tickets: ${tickets.length}`]);
  csv += `Reference,Subject,Status,Category,Platform,Name,Email,Messages,Staff Replies,First Message,Opened (UTC),Last Activity (UTC),Last Message By\n`;
  for (const t of tickets) {
    csv += [
      csvCell(t.ref),
      csvCell(t.subject),
      csvCell(t.status),
      csvCell(t.category),
      csvCell(t.platform),
      csvCell(t.name),
      csvCell(t.email),
      t.messages.length,
      t.messages.filter((m) => m.author === 'staff').length,
      csvCell(t.messages[0]?.body),
      csvCell(iso(t.createdAt)),
      csvCell(iso(t.lastMessageAt)),
      csvCell(t.lastMessageBy),
    ].join(',');
    csv += '\n';
  }
  sendCsv(res, 'support_tickets', p, csv);
});

/**
 * GET /api/export/counts
 * How many records each export would contain for a timeframe (Reports page).
 */
exports.exportCounts = asyncHandler(async (req, res) => {
  const p = period(req);
  const [leads, events, sessions, feedback, tickets] = await Promise.all([
    Lead.countDocuments(p.filter),
    AnalyticsEvent.countDocuments(p.filter),
    AnalyticsEvent.distinct('sessionId', p.filter).then((ids) => ids.length),
    Feedback.countDocuments(p.filter),
    Ticket.countDocuments(p.filter),
  ]);
  res.json({ success: true, timeframe: p.timeframe, counts: { leads, events, sessions, feedback, tickets } });
});
