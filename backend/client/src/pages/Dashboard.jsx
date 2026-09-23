import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchJson } from '../lib/api.js';
import { restoreSession, isAdmin as checkIsAdmin, isMaster, logout } from '../lib/auth.js';
import { eventTypeChartConfig, areaChartConfig, hotspotChartConfig } from '../lib/chartConfigs.js';
import Sidebar from '../components/Sidebar.jsx';
import Topbar from '../components/Topbar.jsx';
import BtnGroup from '../components/BtnGroup.jsx';
import StatCard from '../components/StatCard.jsx';
import ChartCanvas from '../components/ChartCanvas.jsx';
import LeadsPanel from '../components/LeadsPanel.jsx';
import UsersPanel from '../components/UsersPanel.jsx';

const TIMEFRAMES = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: "Today's Open Day" },
  { value: '24h', label: 'Past 24 Hours' },
  { value: '7d', label: 'Past 7 Days' },
  { value: '30d', label: 'Past 30 Days' },
];

const icon = (children) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {children}
  </svg>
);

const ICONS = {
  users: icon(
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  pulse: icon(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />),
  clock: icon(
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  mail: icon(
    <>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </>
  ),
  target: icon(
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
};

function formatDuration(ms) {
  if (!ms || ms <= 0) return '0s';
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('home');
  const [timeframe, setTimeframe] = useState('all');
  const [summary, setSummary] = useState(null);
  const [leads, setLeads] = useState([]);
  const [leadCount, setLeadCount] = useState(null);
  const [users, setUsers] = useState([]);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Rehydrate the signed-in user; restoreSession redirects to login if the token is bad.
  useEffect(() => {
    restoreSession().then((u) => u && setUser(u));
  }, []);

  const loadDashboard = useCallback(async () => {
    setError('');
    try {
      const [summaryRes, leadsRes, usersRes] = await Promise.all([
        fetchJson(`/api/analytics/summary?timeframe=${encodeURIComponent(timeframe)}`),
        fetchJson(`/api/leads?timeframe=${encodeURIComponent(timeframe)}`),
        fetchJson('/api/auth/users').catch(() => ({ users: [] })),
      ]);
      setOnline(true);
      setSummary(summaryRes);
      setLeadCount(leadsRes.count);
      setLeads(leadsRes.leads || []);
      setUsers(usersRes.users || []);
    } catch (err) {
      setOnline(false);
      setError(`Could not load data from backend (${err.message}). Is the server running at ${window.location.origin}?`);
    }
  }, [timeframe]);

  useEffect(() => {
    if (user) loadDashboard();
  }, [user, loadDashboard]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboard().finally(() => setTimeout(() => setRefreshing(false), 300));
  };

  const handleToggleRole = async (userId, nextRole) => {
    try {
      await fetchJson(`/api/auth/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
      });
      const usersRes = await fetchJson('/api/auth/users').catch(() => ({ users: [] }));
      setUsers(usersRes.users || []);
    } catch (err) {
      alert(`Could not update role: ${err.message}`);
    }
  };

  const charts = useMemo(
    () =>
      summary && {
        events: eventTypeChartConfig(summary.eventsByType),
        areas: areaChartConfig(summary.areas),
        hotspots: hotspotChartConfig(summary.hotspots),
      },
    [summary]
  );

  const isAdmin = Boolean(user && checkIsAdmin());
  const loaded = summary !== null;
  const sessions = summary?.uniqueSessions ?? 0;
  const conversion = sessions > 0 ? ((leadCount / sessions) * 100).toFixed(1) : '0.0';

  const stats = [
    { label: 'Unique Sessions', value: Number(sessions).toLocaleString(), subtext: 'Distinct VR visitors', color: 'red', icon: ICONS.users },
    { label: 'Analytics Events', value: Number(summary?.totalEvents ?? 0).toLocaleString(), subtext: 'Total telemetry logs', color: 'yellow', icon: ICONS.pulse },
    { label: 'Avg Visit Time', value: formatDuration(summary?.avgSessionDurationMs), subtext: 'Avg exploration dwell', color: 'red', icon: ICONS.clock },
    { label: 'Total Leads', value: Number(leadCount ?? 0).toLocaleString(), subtext: 'Student inquiries', color: 'yellow', icon: ICONS.mail },
    { label: 'Conversion Rate', value: `${conversion}%`, subtext: 'Inquiry-to-visit ratio', color: 'red', icon: ICONS.target },
  ];

  return (
    <>
      <Sidebar page={page} onNavigate={setPage} />

      <div className="main-wrapper">
        <Topbar
          user={user}
          isAdmin={isAdmin}
          online={online}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onLogout={logout}
        />

        <main className="content">
          {error && <div className="error-banner">{error}</div>}

          {page === 'home' && (
            <section className="page active">
              <section className="time-filter-section">
                <div className="time-filter-wrapper">
                  <div className="time-filter-label">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>Time Range:</span>
                  </div>
                  <BtnGroup options={TIMEFRAMES} value={timeframe} onChange={setTimeframe} />
                </div>
              </section>

              <section className="stats">
                {stats.map((s) => (
                  <StatCard key={s.label} {...s} value={loaded ? s.value : '—'} />
                ))}
              </section>

              <section className="charts-grid">
                <div className="panel chart-panel">
                  <h2>VR Event Breakdown</h2>
                  <div className="chart-container">{charts && <ChartCanvas config={charts.events} />}</div>
                </div>
                <div className="panel chart-panel">
                  <h2>Campus Area Activity</h2>
                  <div className="chart-container">{charts && <ChartCanvas config={charts.areas} />}</div>
                </div>
                <div className="panel chart-panel">
                  <h2>Top Visited Hotspots</h2>
                  <div className="chart-container">{charts && <ChartCanvas config={charts.hotspots} />}</div>
                </div>
              </section>

              <LeadsPanel leads={leads} isAdmin={isAdmin} />

              {isAdmin && (
                <UsersPanel
                  users={users}
                  currentUserId={user?.id}
                  canManageRoles={isMaster()}
                  onToggleRole={handleToggleRole}
                />
              )}
            </section>
          )}
        </main>
      </div>
    </>
  );
}
