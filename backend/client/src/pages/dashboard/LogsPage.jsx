import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BtnGroup from '../../components/BtnGroup.jsx';
import Icon from '../../components/Icon.jsx';
import { fetchJson } from '../../lib/api.js';
import useAutoRefresh from '../../lib/useAutoRefresh.js';

const TIMEFRAMES = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
];

// Same colours as the event breakdown chart.
const EVENT_COLORS = {
  session_start: '#4099ff',
  session_end: '#7759de',
  area_enter: '#2ed8b6',
  area_exit: '#ffb64d',
  hotspot_view: '#ff5370',
  info_request: '#00bcd4',
  objective_complete: '#8bc34a',
};

const FETCH_LIMIT = 500;
const PAGE_SIZE = 50;
const LIVE_INTERVAL_MS = 5000;

const pretty = (s) => (s || '').replace(/_/g, ' ');
const tidyName = (s) => (s || '').replace(/^(LVL_|BP_|hotspot_)/i, '').replace(/_/g, ' ');

function formatDuration(ms) {
  if (!ms) return '';
  const sec = Math.round(ms / 1000);
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function timeAgo(date) {
  const sec = Math.round((Date.now() - date) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  return `${Math.floor(sec / 86400)} d ago`;
}

function EventBadge({ type }) {
  const color = EVENT_COLORS[type] || '#90a4ae';
  return (
    <span className="event-badge" style={{ color, background: `${color}1f` }}>
      <span className="event-dot" style={{ background: color }} />
      {pretty(type)}
    </span>
  );
}

/**
 * VR Activity Logs: every event the tour sends, newest first, with search,
 * type filters, a live mode and per-row details.
 */
export default function LogsPage() {
  const [timeframe, setTimeframe] = useState('all');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const [fresh, setFresh] = useState(new Set()); // ids that just arrived in live mode
  const known = useRef(new Set());

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true);
      try {
        const res = await fetchJson(
          `/api/analytics/events?timeframe=${encodeURIComponent(timeframe)}&limit=${FETCH_LIMIT}`
        );
        const list = res.events || [];
        if (quiet) {
          setFresh(new Set(list.filter((e) => !known.current.has(e._id)).map((e) => e._id)));
        }
        known.current = new Set(list.map((e) => e._id));
        setEvents(list);
        setError('');
      } catch (err) {
        setError(`Could not load logs (${err.message}).`);
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [timeframe]
  );

  useEffect(() => {
    setFresh(new Set());
    load();
  }, [load]);

  // Live mode: poll while the tab is visible.
  useEffect(() => {
    if (!live) return undefined;
    const timer = setInterval(() => {
      if (!document.hidden) load({ quiet: true });
    }, LIVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [live, load]);

  // Outside live mode, still refresh quietly every minute.
  useAutoRefresh(() => load({ quiet: true }), 60000, !live);

  // Only offer type chips for types that actually appear, plus "All".
  const typeOptions = useMemo(() => {
    const present = [...new Set(events.map((e) => e.eventType))].sort(
      (a, b) => Object.keys(EVENT_COLORS).indexOf(a) - Object.keys(EVENT_COLORS).indexOf(b)
    );
    return [{ value: 'all', label: 'All' }, ...present.map((t) => ({ value: t, label: pretty(t) }))];
  }, [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (typeFilter !== 'all' && e.eventType !== typeFilter) return false;
      if (!q) return true;
      return [e.eventType, e.sessionId, e.area, e.hotspotId, e.platform, e.appVersion]
        .some((v) => v && String(v).toLowerCase().includes(q));
    });
  }, [events, search, typeFilter]);

  useEffect(() => setPage(0), [search, typeFilter, timeframe]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const sessions = useMemo(() => new Set(filtered.map((e) => e.sessionId)).size, [filtered]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Activity Logs</h1>
          <div className="breadcrumb">Home / <b>Activity Logs</b></div>
        </div>
        <div className="toolbar">
          <BtnGroup options={TIMEFRAMES} value={timeframe} onChange={setTimeframe} />
          <button
            className={`btn ${live ? 'btn-live' : 'btn-light'}`}
            onClick={() => setLive((l) => !l)}
            aria-pressed={live}
            title="Refresh automatically every 5 seconds"
          >
            <span className={`live-dot${live ? ' on' : ''}`} />
            {live ? 'Live' : 'Go live'}
          </button>
          <button className="btn btn-light" onClick={() => load()} disabled={loading}>
            <Icon name="refresh" size={15} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <Icon name="x" size={16} />
          {error}
        </div>
      )}

      <section className="card">
        <div className="card-header logs-filters">
          <label className="search-box">
            <Icon name="search" size={16} />
            <input
              type="search"
              placeholder="Search session, area, hotspot, platform…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <BtnGroup options={typeOptions} value={typeFilter} onChange={setTypeFilter} />
        </div>

        <div className="logs-summary">
          <span>
            <b>{filtered.length.toLocaleString()}</b> {filtered.length === 1 ? 'event' : 'events'} ·{' '}
            <b>{sessions.toLocaleString()}</b> {sessions === 1 ? 'session' : 'sessions'}
          </span>
          {events.length >= FETCH_LIMIT && <span className="hint">Showing the latest {FETCH_LIMIT} events</span>}
        </div>

        <div className="table-wrap">
          <table className="logs-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Session</th>
                <th>Area</th>
                <th>Hotspot</th>
                <th>Duration</th>
                <th>Platform</th>
              </tr>
            </thead>
            <tbody>
              {loading && events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">Loading…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">No events match.</td>
                </tr>
              ) : (
                rows.map((e) => {
                  const date = new Date(e.createdAt);
                  const open = expanded === e._id;
                  return (
                    <Fragment key={e._id}>
                      <tr
                        className={`log-row${open ? ' open' : ''}${fresh.has(e._id) ? ' fresh' : ''}`}
                        onClick={() => setExpanded(open ? null : e._id)}
                      >
                        <td title={date.toLocaleString()}>
                          <div className="cell-strong">{date.toLocaleTimeString()}</div>
                          <div className="cell-sub">{timeAgo(date)}</div>
                        </td>
                        <td><EventBadge type={e.eventType} /></td>
                        <td className="mono" title={e.sessionId}>{e.sessionId?.slice(0, 8)}</td>
                        <td>{tidyName(e.area) || <span className="cell-muted">—</span>}</td>
                        <td>{tidyName(e.hotspotId) || <span className="cell-muted">—</span>}</td>
                        <td className="cell-muted">{formatDuration(e.durationMs) || '—'}</td>
                        <td className="cell-muted">{e.platform || '—'}</td>
                      </tr>
                      {open && (
                        <tr className="log-detail">
                          <td colSpan={7}>
                            <div className="log-detail-actions">
                              <button
                                className="btn btn-light btn-sm"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setSearch(e.sessionId);
                                  setTypeFilter('all');
                                  setExpanded(null);
                                }}
                              >
                                <Icon name="search" size={13} />
                                Show this visitor's journey
                              </button>
                            </div>
                            <pre>{JSON.stringify(e, null, 2)}</pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="pagination">
            <span className="hint">
              Page {page + 1} of {pageCount}
            </span>
            <button className="btn btn-light btn-sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
              <Icon name="chevronLeft" size={14} />
              Prev
            </button>
            <button className="btn btn-light btn-sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pageCount - 1}>
              Next
              <Icon name="chevronRight" size={14} />
            </button>
          </div>
        )}
      </section>
    </>
  );
}
