/**
 * Shared "timeframe" query parameter used by the exports:
 * all | today | 24h | 7d | 30d  ->  a MongoDB createdAt filter (or {} for all).
 */
const TIMEFRAMES = ['all', 'today', '24h', '7d', '30d'];

const LABELS = {
  all: 'All time',
  today: 'Today',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};

function normalizeTimeframe(value) {
  return TIMEFRAMES.includes(value) ? value : 'all';
}

function timeframeFilter(timeframe) {
  const day = 24 * 60 * 60 * 1000;
  switch (normalizeTimeframe(timeframe)) {
    case 'today': {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return { createdAt: { $gte: start } };
    }
    case '24h':
      return { createdAt: { $gte: new Date(Date.now() - day) } };
    case '7d':
      return { createdAt: { $gte: new Date(Date.now() - 7 * day) } };
    case '30d':
      return { createdAt: { $gte: new Date(Date.now() - 30 * day) } };
    default:
      return {};
  }
}

module.exports = { TIMEFRAMES, LABELS, normalizeTimeframe, timeframeFilter };
