import { useCallback, useEffect, useState } from 'react';
import { fetchJson } from '../lib/api.js';
import { restoreSession, isAdmin as checkIsAdmin, isMaster, logout } from '../lib/auth.js';
import { fetchAvatar } from '../lib/avatar.js';
import { useTheme } from '../lib/theme.js';
import useAutoRefresh, { useTitleCount } from '../lib/useAutoRefresh.js';
import Sidebar from '../components/Sidebar.jsx';
import Header from '../components/Header.jsx';
import Icon from '../components/Icon.jsx';
import Overview from './dashboard/Overview.jsx';
import UsersPage from './dashboard/UsersPage.jsx';
import Settings from './dashboard/Settings.jsx';
import LogsPage from './dashboard/LogsPage.jsx';
import FeedbackPage from './dashboard/FeedbackPage.jsx';
import TicketsPage from './dashboard/TicketsPage.jsx';
import SystemStatusPage from './dashboard/SystemStatusPage.jsx';
import ReportsPage from './dashboard/ReportsPage.jsx';

const MOBILE_QUERY = '(max-width: 991px)';

// The page lives in the URL hash (#users, #settings) so refresh and the
// browser back button keep you where you were.
function pageFromHash() {
  const page = window.location.hash.replace('#', '');
  return ['logs', 'tickets', 'feedback', 'reports', 'users', 'status', 'settings'].includes(page) ? page : 'overview';
}

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [avatar, setAvatar] = useState('');
  const [page, setPage] = useState(pageFromHash);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [themeChoice, setThemeChoice, theme] = useTheme();

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
    restoreSession().then((u) => {
      if (!u) return;
      setUser(u);
      fetchAvatar().then(setAvatar).catch(() => {}); // no picture is fine
    });
  }, []);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (next) => {
    window.location.hash = next === 'overview' ? '' : next;
    setPage(next);
    setMobileOpen(false);
  };

  const toggleSidebar = () => {
    if (window.matchMedia(MOBILE_QUERY).matches) setMobileOpen((o) => !o);
    else setCollapsed((c) => !c);
  };

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
      setError(`Could not load data from the backend (${err.message}). Is the server running at ${window.location.origin}?`);
    }
  }, [timeframe]);

  useEffect(() => {
    if (user) loadDashboard();
  }, [user, loadDashboard]);

  // Keep stats, charts, leads and users fresh without a manual refresh.
  useAutoRefresh(() => user && loadDashboard(), 60000);

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

  // Keep your own row in the Users table in sync when you change your photo.
  const handleAvatarChange = (next) => {
    setAvatar(next);
    setUsers((list) => list.map((u) => (u._id === user?.id ? { ...u, avatar: next } : u)));
  };

  const isAdmin = Boolean(user && checkIsAdmin());

  // Sidebar badge: support tickets waiting on a staff reply (admins only).
  const [ticketsNeedingReply, setTicketsNeedingReply] = useState(0);
  const loadTicketStats = useCallback(async () => {
    try {
      const res = await fetchJson('/api/tickets/stats');
      setTicketsNeedingReply(res.needsReply || 0);
    } catch {
      // Badge is a nice-to-have; ignore failures.
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadTicketStats();
  }, [isAdmin, loadTicketStats]);

  useAutoRefresh(() => isAdmin && loadTicketStats(), 60000);
  // "(2) PRJ381 Dashboard" in the browser tab when tickets are waiting.
  useTitleCount(isAdmin ? ticketsNeedingReply : 0);

  const adminOnly = ['users', 'feedback', 'tickets', 'reports', 'status'];
  const currentPage = adminOnly.includes(page) && !isAdmin ? 'overview' : page;

  const sections = [
    {
      caption: 'Navigation',
      items: [
        { id: 'overview', label: 'Dashboard', icon: 'home' },
        { id: 'logs', label: 'Activity Logs', icon: 'list' },
        ...(isAdmin
          ? [
              { id: 'tickets', label: 'Tickets', icon: 'inbox', badge: ticketsNeedingReply },
              { id: 'feedback', label: 'Feedback', icon: 'message' },
              { id: 'reports', label: 'Reports', icon: 'download' },
              { id: 'users', label: 'Users', icon: 'users' },
              { id: 'status', label: 'System Status', icon: 'activity' },
            ]
          : []),
      ],
    },
    // Settings lives in the header profile menu, not here.
  ];

  return (
    <div className={`app${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
      <Sidebar sections={sections} page={currentPage} onNavigate={navigate} />
      <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />

      <div className="main">
        <Header
          user={user}
          avatar={avatar}
          online={online}
          theme={theme}
          onToggleTheme={() => setThemeChoice(theme === 'dark' ? 'light' : 'dark')}
          onToggleSidebar={toggleSidebar}
          onNavigate={navigate}
          onLogout={logout}
        />

        <main className="content">
          {error && (
            <div className="alert alert-danger">
              <Icon name="x" size={16} />
              {error}
            </div>
          )}

          {currentPage === 'overview' && (
            <Overview
              summary={summary}
              leads={leads}
              leadCount={leadCount}
              timeframe={timeframe}
              onTimeframe={setTimeframe}
              isAdmin={isAdmin}
              theme={theme}
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          )}

          {currentPage === 'users' && (
            <UsersPage
              users={users}
              currentUserId={user?.id}
              canManageRoles={isMaster()}
              onToggleRole={handleToggleRole}
            />
          )}

          {currentPage === 'logs' && user && <LogsPage />}

          {currentPage === 'tickets' && isAdmin && <TicketsPage onChanged={loadTicketStats} />}

          {currentPage === 'feedback' && isAdmin && <FeedbackPage />}

          {currentPage === 'status' && isAdmin && <SystemStatusPage onNavigate={navigate} />}

          {currentPage === 'reports' && isAdmin && <ReportsPage />}

          {currentPage === 'settings' && user && (
            <Settings
              user={user}
              avatar={avatar}
              onAvatarChange={handleAvatarChange}
              themeChoice={themeChoice}
              onThemeChoice={setThemeChoice}
            />
          )}
        </main>
      </div>
    </div>
  );
}
