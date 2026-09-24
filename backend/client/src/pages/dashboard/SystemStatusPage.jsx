import { useCallback, useEffect, useState } from 'react';
import StatCard from '../../components/StatCard.jsx';
import Icon from '../../components/Icon.jsx';
import { fetchJson } from '../../lib/api.js';
import useAutoRefresh from '../../lib/useAutoRefresh.js';

const REFRESH_MS = 30000;

function ago(date) {
  if (!date) return 'never';
  const sec = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  return `${Math.floor(sec / 86400)} d ago`;
}

function duration(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function bytes(n) {
  if (!n) return '';
  const gb = n / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(2)} GB` : `${Math.round(n / 1024 ** 2)} MB`;
}

function Check({ ok, warn, children }) {
  const kind = ok ? 'ok' : warn ? 'warn' : 'bad';
  return (
    <span className={`st-check st-${kind}`}>
      <Icon name={ok ? 'check' : 'x'} size={12} />
      {children}
    </span>
  );
}

/** Works out the headline problems from a /api/status response. */
function findProblems(s, reachable) {
  if (!reachable) return [{ level: 'bad', text: 'The backend is not responding.' }];
  const problems = [];
  if (s.database.state !== 'connected') {
    problems.push({ level: 'bad', text: `Database is ${s.database.state} — leads, analytics and tickets can't be saved.` });
  }
  // One line per platform, listing whatever is wrong with it.
  s.downloads.platforms.forEach((p) => {
    const issues = [];
    if (!p.local.present) issues.push(`the Download button's file is missing (builds/${p.file})`);
    if (p.github && !p.github.ok) {
      issues.push(`the GitHub release link ${p.github.status ? `returns ${p.github.status}` : 'is unreachable'}`);
    }
    if (issues.length) problems.push({ level: 'warn', text: `${p.name}: ${issues.join(', and ')}.` });
  });
  return problems;
}

/**
 * Admin page: is everything working? Server, database, VR telemetry,
 * download files and today's activity at a glance. Refreshes every 30s.
 */
export default function SystemStatusPage({ onNavigate }) {
  const [status, setStatus] = useState(null);
  const [reachable, setReachable] = useState(true);
  const [latency, setLatency] = useState(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    const t0 = performance.now();
    try {
      const res = await fetchJson('/api/status');
      setLatency(Math.round(performance.now() - t0));
      setStatus(res);
      setReachable(true);
    } catch {
      setReachable(false);
      setLatency(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  useAutoRefresh(check, REFRESH_MS);

  const problems = status || !reachable ? findProblems(status, reachable) : [];
  const level = problems.some((p) => p.level === 'bad') ? 'bad' : problems.length ? 'warn' : 'ok';
  const s = status;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>System Status</h1>
          <div className="breadcrumb">Home / <b>System Status</b></div>
        </div>
        <div className="toolbar">
          {s && <span className="cell-sub">Checked {new Date(s.checkedAt).toLocaleTimeString()} · auto every 30s</span>}
          <button className="btn btn-light" onClick={check} disabled={checking}>
            <Icon name="refresh" size={15} className={checking ? 'spin' : ''} />
            Check now
          </button>
        </div>
      </div>

      {(s || !reachable) && (
        <section className={`st-banner st-banner-${level}`}>
          <span className="st-banner-icon">
            <Icon name={level === 'ok' ? 'check' : 'x'} size={22} />
          </span>
          <div>
            <strong>
              {level === 'ok' ? 'All systems operational' : level === 'bad' ? 'Something is down' : 'Working, with warnings'}
            </strong>
            {problems.length > 0 ? (
              <ul>
                {problems.map((p) => (
                  <li key={p.text}>{p.text}</li>
                ))}
              </ul>
            ) : (
              <p>The server, database and downloads are all responding.</p>
            )}
          </div>
        </section>
      )}

      {s && (
        <>
          <section className="stats stats-4">
            <StatCard
              title="Server"
              value={reachable ? 'Online' : 'Offline'}
              footer={latency != null ? `Responded in ${latency} ms · v${s.server.version}` : '—'}
              color={reachable ? 'green' : 'red'}
              icon="monitor"
            />
            <StatCard
              title="Database"
              value={s.database.state === 'connected' ? 'Connected' : s.database.state}
              footer={s.database.pingMs != null ? `Ping ${s.database.pingMs} ms` : 'MongoDB Atlas'}
              color={s.database.state === 'connected' ? 'blue' : 'red'}
              icon="activity"
            />
            <StatCard
              title="Uptime"
              value={duration(s.server.uptimeSeconds)}
              footer={`Restarted ${ago(s.server.startedAt)}`}
              color="purple"
              icon="clock"
            />
            <StatCard
              title="VR Telemetry"
              value={s.telemetry ? ago(s.telemetry.lastEventAt) : '—'}
              footer={s.telemetry ? `${s.telemetry.eventsLastHour} events in the last hour` : 'Needs the database'}
              color="yellow"
              icon="users"
            />
          </section>

          <section className="grid st-layout">
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>Downloads</h2>
                  <p>
                    Build v{s.downloads.version} · released {s.downloads.releaseDate}
                  </p>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th>Landing page button</th>
                      <th>GitHub release</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {s.downloads.platforms.map((p) => (
                      <tr key={p.key}>
                        <td>
                          <strong className="cell-strong">{p.name}</strong>
                          <div className="cell-sub mono">builds/{p.file}</div>
                        </td>
                        <td>
                          {p.local.present ? (
                            <Check ok>Available · {bytes(p.local.sizeBytes)}</Check>
                          ) : (
                            <Check warn>File missing</Check>
                          )}
                        </td>
                        <td>
                          {!p.github ? (
                            <span className="cell-muted">Not checked</span>
                          ) : p.github.ok ? (
                            <Check ok>Reachable</Check>
                          ) : (
                            <Check warn>{p.github.status ? `Error ${p.github.status}` : p.github.error}</Check>
                          )}
                        </td>
                        <td>
                          <a className="btn btn-light btn-sm" href={p.landingPath} target="_blank" rel="noreferrer">
                            <Icon name="download" size={13} />
                            Test
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="st-note">
                The landing page's Download buttons serve files from the <code>builds/</code> folder on the server. GitHub
                links are rechecked every 5 minutes.
              </p>
            </div>

            <div className="st-side">
              <div className="card">
                <div className="card-header">
                  <div>
                    <h2>Last 24 hours</h2>
                    <p>Activity since this time yesterday</p>
                  </div>
                </div>
                {s.activity && s.telemetry ? (
                  <div className="st-glance">
                    <div>
                      <b>{s.telemetry.sessions24h}</b>
                      <span>VR sessions</span>
                    </div>
                    <div>
                      <b>{s.telemetry.events24h}</b>
                      <span>Events</span>
                    </div>
                    <div>
                      <b>{s.activity.leads24h}</b>
                      <span>Leads</span>
                    </div>
                    <div>
                      <b>{s.activity.feedback24h}</b>
                      <span>Feedback</span>
                    </div>
                    <button className="st-glance-link" onClick={() => onNavigate?.('tickets')}>
                      <b className={s.activity.ticketsNeedingReply ? 'st-alert' : ''}>{s.activity.ticketsNeedingReply}</b>
                      <span>Tickets need a reply →</span>
                    </button>
                  </div>
                ) : (
                  <p className="empty-note">Unavailable while the database is down.</p>
                )}
              </div>

              <div className="card">
                <div className="card-header">
                  <div>
                    <h2>Server details</h2>
                  </div>
                </div>
                <dl className="st-details">
                  <div><dt>Environment</dt><dd>{s.server.env}</dd></div>
                  <div><dt>App version</dt><dd>{s.server.version}</dd></div>
                  <div><dt>Node.js</dt><dd>{s.server.node}</dd></div>
                  <div><dt>Memory</dt><dd>{s.server.memoryMb} MB</dd></div>
                  <div><dt>Started</dt><dd>{new Date(s.server.startedAt).toLocaleString()}</dd></div>
                  <div><dt>Commit</dt><dd className="mono">{s.server.commit ? s.server.commit.slice(0, 7) : '—'}</dd></div>
                </dl>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
