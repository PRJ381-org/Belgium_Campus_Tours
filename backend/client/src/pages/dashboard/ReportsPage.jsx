import { useCallback, useEffect, useState } from 'react';
import BtnGroup from '../../components/BtnGroup.jsx';
import Icon from '../../components/Icon.jsx';
import { fetchJson } from '../../lib/api.js';
import { parseCsv } from '../../lib/csv.js';
import useAutoRefresh from '../../lib/useAutoRefresh.js';
import {
  fetchCsvText,
  downloadLeadsCsv,
  downloadSummaryCsv,
  downloadTelemetryCsv,
  downloadFeedbackCsv,
  downloadTicketsCsv,
} from '../../lib/export.js';

const TIMEFRAMES = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
];

const REPORTS = [
  {
    key: 'leads',
    title: 'Student Leads',
    icon: 'mail',
    color: 'blue',
    description: 'Everyone who asked for more information in the tour.',
    useFor: 'Send to the admissions / marketing team for follow-ups.',
    columns: ['Email', 'Source (end screen or hotspot)', 'Session', 'Date'],
    count: (c) => `${c.leads.toLocaleString()} ${c.leads === 1 ? 'lead' : 'leads'}`,
    endpoint: '/api/export/leads',
    download: downloadLeadsCsv,
  },
  {
    key: 'summary',
    title: 'Executive Summary',
    icon: 'activity',
    color: 'purple',
    description: 'A one-page overview: KPIs, time spent per campus area and top hotspots.',
    useFor: 'Share with lecturers or management after the open day.',
    columns: ['KPIs', 'Area dwell time', 'Hotspot views'],
    count: (c) => `Based on ${c.sessions.toLocaleString()} ${c.sessions === 1 ? 'session' : 'sessions'}`,
    endpoint: '/api/export/summary',
    download: downloadSummaryCsv,
    textPreview: true, // several sections, so preview as text rather than one table
  },
  {
    key: 'telemetry',
    title: 'Raw Telemetry',
    icon: 'list',
    color: 'yellow',
    description: 'Every event the VR tour sent, one row each (up to 10,000).',
    useFor: 'Load into Power BI or Excel for your own charts and analysis.',
    columns: ['Session', 'Event type', 'Area', 'Hotspot', 'Duration', 'Platform', 'Time'],
    count: (c) => `${c.events.toLocaleString()} ${c.events === 1 ? 'event' : 'events'}`,
    endpoint: '/api/export/analytics',
    download: downloadTelemetryCsv,
  },
  {
    key: 'feedback',
    title: 'Open Day Feedback',
    icon: 'star',
    color: 'green',
    description: 'Ratings and comments from the feedback form on the website.',
    useFor: 'Review what visitors liked and what to improve.',
    columns: ['Rating', 'Visitor type', 'Platform', 'Liked', 'Could improve', 'Name', 'Email'],
    count: (c) => `${c.feedback.toLocaleString()} ${c.feedback === 1 ? 'response' : 'responses'}`,
    endpoint: '/api/export/feedback',
    download: downloadFeedbackCsv,
  },
  {
    key: 'tickets',
    title: 'Support Tickets',
    icon: 'inbox',
    color: 'red',
    description: 'Issues visitors reported through the chat button, with status and reply counts.',
    useFor: 'Spot common problems (downloads, installs, bugs) to fix.',
    columns: ['Reference', 'Subject', 'Status', 'Category', 'Name', 'Email', 'Messages', 'Opened'],
    count: (c) => `${c.tickets.toLocaleString()} ${c.tickets === 1 ? 'ticket' : 'tickets'}`,
    endpoint: '/api/export/tickets',
    download: downloadTicketsCsv,
  },
];

const PREVIEW_ROWS = 5;

function Preview({ report, timeframe, onClose }) {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    fetchCsvText(report.endpoint, timeframe)
      .then((text) =>
        setState(
          report.textPreview
            ? { text: text.split('\n').filter((l) => !l.startsWith('#')).join('\n').trim() }
            : { table: parseCsv(text, PREVIEW_ROWS) }
        )
      )
      .catch((err) => setState({ error: err.message }));
  }, [report, timeframe]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal rp-modal" role="dialog" aria-modal="true" aria-labelledby="rp-preview-title">
        <div className="card-header">
          <div>
            <h2 id="rp-preview-title">{report.title} — preview</h2>
            <p>{report.textPreview ? 'Full report' : `First ${PREVIEW_ROWS} rows`} · {TIMEFRAMES.find((t) => t.value === timeframe)?.label}</p>
          </div>
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close preview">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="rp-preview-body">
          {state.loading && <p className="empty-note">Loading…</p>}
          {state.error && <p className="empty-note">Couldn't load the preview ({state.error}).</p>}
          {state.text && <pre className="rp-text">{state.text}</pre>}
          {state.table &&
            (state.table.rows.length === 0 ? (
              <p className="empty-note">No records in this period.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {state.table.header.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.table.rows.map((r, i) => (
                      <tr key={i}>
                        {r.map((cell, j) => (
                          <td key={j} title={cell}>
                            {cell.length > 60 ? `${cell.slice(0, 60)}…` : cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </div>
        <div className="modal-footer">
          <div className="header-spacer" />
          <button className="btn btn-light" onClick={onClose}>
            Close
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              report.download(timeframe);
              onClose();
            }}
          >
            <Icon name="download" size={14} />
            Download CSV
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Admin page listing every CSV export as a card, with a shared time range,
 * record counts, a preview and a download button.
 */
export default function ReportsPage() {
  const [timeframe, setTimeframe] = useState('all');
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState('');
  const [preparing, setPreparing] = useState(null);
  const [previewing, setPreviewing] = useState(null);

  const loadCounts = useCallback(async () => {
    try {
      const res = await fetchJson(`/api/export/counts?timeframe=${timeframe}`);
      setCounts(res.counts);
      setError('');
    } catch (err) {
      setError(`Could not load record counts (${err.message}).`);
    }
  }, [timeframe]);

  useEffect(() => {
    setCounts(null);
    loadCounts();
  }, [loadCounts]);

  useAutoRefresh(loadCounts, 60000);

  const download = (report) => {
    report.download(timeframe);
    // The browser handles the file itself; show a short "preparing" state so the click feels acknowledged.
    setPreparing(report.key);
    setTimeout(() => setPreparing((k) => (k === report.key ? null : k)), 2000);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <div className="breadcrumb">Home / <b>Reports</b></div>
        </div>
        <div className="toolbar">
          <span className="cell-sub">Time range for all reports:</span>
          <BtnGroup options={TIMEFRAMES} value={timeframe} onChange={setTimeframe} />
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <Icon name="x" size={16} />
          {error}
        </div>
      )}

      <section className="rp-grid">
        {REPORTS.map((r) => (
          <article key={r.key} className="card rp-card">
            <div className="rp-card-top">
              <span className={`rp-icon stat-card ${r.color}`}>
                <Icon name={r.icon} size={20} />
              </span>
              <div>
                <h2>{r.title}</h2>
                <span className="rp-count">{counts ? r.count(counts) : 'Counting…'}</span>
              </div>
            </div>
            <p className="rp-desc">{r.description}</p>
            <p className="rp-use">
              <Icon name="check" size={13} /> {r.useFor}
            </p>
            <div className="rp-columns">
              {r.columns.map((c) => (
                <span key={c} className="fb-tag">
                  {c}
                </span>
              ))}
            </div>
            <div className="rp-actions">
              <button className="btn btn-light" onClick={() => setPreviewing(r)}>
                <Icon name="eye" size={14} />
                Preview
              </button>
              <button className="btn btn-primary" onClick={() => download(r)} disabled={preparing === r.key}>
                <Icon name={preparing === r.key ? 'refresh' : 'download'} size={14} className={preparing === r.key ? 'spin' : ''} />
                {preparing === r.key ? 'Preparing…' : 'Download CSV'}
              </button>
            </div>
          </article>
        ))}

        <article className="card rp-card rp-tips">
          <h2>Opening the files</h2>
          <ul>
            <li>
              <b>Excel:</b> double-click the file. If everything lands in one column, use <i>Data → Text to Columns</i> with a comma.
            </li>
            <li>
              <b>Power BI:</b> <i>Get data → Text/CSV</i>, then pick the file. Raw Telemetry is best for building your own charts.
            </li>
            <li>
              <b>Google Sheets:</b> <i>File → Import → Upload</i>.
            </li>
            <li>The first few lines starting with # describe the report and the time range; the data starts below them.</li>
          </ul>
        </article>
      </section>

      {previewing && <Preview report={previewing} timeframe={timeframe} onClose={() => setPreviewing(null)} />}
    </>
  );
}
