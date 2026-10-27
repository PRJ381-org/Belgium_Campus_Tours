const Lead = require('../models/Lead');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Helper to build MongoDB date filter from timeframe query parameter.
 */
function getDateFilter(timeframe) {
  if (!timeframe || timeframe === 'all') return null;

  if (timeframe === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return { createdAt: { $gte: start } };
  }
  if (timeframe === '24h') {
    return { createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } };
  }
  if (timeframe === '7d') {
    return { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } };
  }
  if (timeframe === '30d') {
    return { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } };
  }
  return null;
}

exports.createLead = asyncHandler(async (req, res) => {
  const { email, hotspotId, sessionId, source } = req.body;
  // Derived server-side so old clients (which only send hotspotId) and any
  // future client that sends `source` directly both land on the same value.
  const lead = await Lead.create({
    email,
    hotspotId,
    sessionId,
    source: Lead.deriveSource({ source, hotspotId }),
  });
  res.status(201).json({ success: true, id: lead._id, source: lead.source });
});

// GET /api/leads -> all leads, with optional timeframe filtering
exports.listLeads = asyncHandler(async (req, res) => {
  const { timeframe = 'all' } = req.query;
  const dateFilter = getDateFilter(timeframe);
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);

  const query = dateFilter || {};
  // count is the real total, not just how many rows fit under the limit - the
  // dashboard's lead count would otherwise stop at 200.
  const [leads, count] = await Promise.all([
    Lead.find(query).sort({ createdAt: -1 }).limit(limit),
    Lead.countDocuments(query),
  ]);
  res.json({ success: true, timeframe, count, leads });
});
