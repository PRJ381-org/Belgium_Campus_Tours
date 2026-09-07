/**
 * Main Dashboard Application Entry Point.
 *
 * Coordinates authentication state, analytics data loading, chart rendering, and table interactions.
 */
import { fetchJson } from './api.js';
import { requireLogin, restoreSession, isAdmin, getCurrentUser, logout } from './auth.js';
import { renderEventTypeChart, renderAreaChart, renderHotspotChart, renderTimelineChart } from './charts.js';
import {
  downloadLeadsCsv,
  downloadSummaryCsv,
  downloadTelemetryCsv,
} from './export.js';

// Bail out to the login page immediately if there's no session at all.
requireLogin();

// State caches
let allLeads = [];
let allUsers = [];
let currentTimeframe = 'all';
let leadsSort = 'newest';
let usersFilter = 'all';
let usersSort = 'newest';

function setConnectionStatus(isOnline) {
  const dot = document.querySelector('.status-dot');
  const text = document.getElementById('connection-status');
  if (!dot || !text) return;

  if (isOnline) {
    dot.classList.remove('offline');
    text.textContent = 'Live';
  } else {
    dot.classList.add('offline');
    text.textContent = 'Offline';
  }
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '0s';
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}

function renderStats({ leads = 0, events = 0, sessions = 0, avgDurationMs = 0 }) {
  const statLeads = document.getElementById('stat-leads');
  const statEvents = document.getElementById('stat-events');
  const statSessions = document.getElementById('stat-sessions');
  const statConversion = document.getElementById('stat-conversion');
  const statDuration = document.getElementById('stat-duration');

  if (statLeads) statLeads.textContent = Number(leads).toLocaleString();
  if (statEvents) statEvents.textContent = Number(events).toLocaleString();
  if (statSessions) statSessions.textContent = Number(sessions).toLocaleString();
  if (statDuration) statDuration.textContent = formatDuration(avgDurationMs);

  if (statConversion) {
    const conversionRate = sessions > 0 ? ((leads / sessions) * 100).toFixed(1) : '0.0';
    statConversion.textContent = `${conversionRate}%`;
  }
}

function renderLeads(leads) {
  const tbody = document.querySelector('#leads-table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!leads || leads.length === 0) {
    tbody.innerHTML = `<tr><td colspan="2">No matching leads found.</td></tr>`;
    return;
  }

  for (const lead of leads) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${lead.email}</td>
      <td>${new Date(lead.createdAt).toLocaleString()}</td>
    `;
    tbody.appendChild(row);
  }
}

function renderUsers(users) {
  const tbody = document.querySelector('#users-table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4">No registered users found.</td></tr>`;
    return;
  }

  for (const user of users) {
    const row = document.createElement('tr');
    const roleBadgeClass = user.role === 'admin' ? 'role-admin' : 'role-viewer';
    row.innerHTML = `
      <td><strong>${user.name || 'Campus Member'}</strong></td>
      <td>${user.email}</td>
      <td><span class="role-badge ${roleBadgeClass}">${user.role || 'viewer'}</span></td>
      <td>${new Date(user.createdAt).toLocaleDateString()}</td>
    `;
    tbody.appendChild(row);
  }
}

function applyLeadsFilterAndSort() {
  let filtered = [...allLeads];

  // Sort
  if (leadsSort === 'newest') {
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (leadsSort === 'oldest') {
    filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else if (leadsSort === 'email') {
    filtered.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
  }

  renderLeads(filtered);
}

function applyUsersFilterAndSort() {
  let filtered = [...allUsers];

  // Role filter
  if (usersFilter !== 'all') {
    filtered = filtered.filter((u) => u.role === usersFilter);
  }

  // Sort
  if (usersSort === 'newest') {
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (usersSort === 'name') {
    filtered.sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''));
  }

  renderUsers(filtered);
}

function setupQuickActionListeners() {
  // Timeframe Filter Buttons
  document.querySelectorAll('#timeframe-filter-group .btn-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#timeframe-filter-group .btn-chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentTimeframe = btn.dataset.timeframe;
      loadDashboard();
    });
  });

  // Leads Sort Buttons
  document.querySelectorAll('#leads-sort-group .btn-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#leads-sort-group .btn-chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      leadsSort = btn.dataset.sort;
      applyLeadsFilterAndSort();
    });
  });

  // Users Filter Buttons
  document.querySelectorAll('#users-filter-group .btn-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#users-filter-group .btn-chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      usersFilter = btn.dataset.filter;
      applyUsersFilterAndSort();
    });
  });

  // Users Sort Buttons
  document.querySelectorAll('#users-sort-group .btn-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#users-sort-group .btn-chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      usersSort = btn.dataset.sort;
      applyUsersFilterAndSort();
    });
  });
}

function showError(message) {
  const main = document.querySelector('.content');
  if (!main) return;

  const existing = document.querySelector('.error-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.className = 'error-banner';
  banner.textContent = message;
  main.prepend(banner);
}

async function loadDashboard() {
  const existingError = document.querySelector('.error-banner');
  if (existingError) existingError.remove();

  try {
    const [summary, leadsRes, usersRes] = await Promise.all([
      fetchJson(`/api/analytics/summary?timeframe=${encodeURIComponent(currentTimeframe)}`),
      fetchJson(`/api/leads?timeframe=${encodeURIComponent(currentTimeframe)}`),
      fetchJson('/api/auth/users').catch(() => ({ users: [] })),
    ]);

    setConnectionStatus(true);
    renderStats({
      leads: leadsRes.count,
      events: summary.totalEvents,
      sessions: summary.uniqueSessions,
      avgDurationMs: summary.avgSessionDurationMs,
    });
    renderEventTypeChart('events-chart', summary.eventsByType);
    renderAreaChart('area-chart', summary.areas);
    renderHotspotChart('hotspot-chart', summary.hotspots);

    allLeads = leadsRes.leads || [];
    allUsers = usersRes.users || [];
    applyLeadsFilterAndSort();
    applyUsersFilterAndSort();
  } catch (err) {
    setConnectionStatus(false);
    showError(
      `Could not load data from backend (${err.message}). Is the server running at ${window.location.origin}?`
    );
  }
}

// Wire up Refresh Button
const btnRefresh = document.getElementById('btn-refresh');
if (btnRefresh) {
  btnRefresh.addEventListener('click', () => {
    btnRefresh.style.opacity = '0.6';
    loadDashboard().finally(() => {
      setTimeout(() => (btnRefresh.style.opacity = '1'), 300);
    });
  });
}

// Wire up Logout button
const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
  btnLogout.addEventListener('click', logout);
}

// Wire up Export Dropdown & Download Buttons
function setupExportListeners() {
  const exportDropdown = document.getElementById('admin-export-dropdown');
  const btnExportToggle = document.getElementById('btn-export-toggle');
  const btnExportLeads = document.getElementById('export-leads-btn');
  const btnExportSummary = document.getElementById('export-summary-btn');
  const btnExportTelemetry = document.getElementById('export-telemetry-btn');
  const btnQuickExportLeads = document.getElementById('btn-quick-export-leads');

  if (btnExportToggle && exportDropdown) {
    btnExportToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      exportDropdown.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!exportDropdown.contains(e.target)) {
        exportDropdown.classList.remove('open');
      }
    });
  }

  if (btnExportLeads) {
    btnExportLeads.addEventListener('click', () => {
      if (exportDropdown) exportDropdown.classList.remove('open');
      downloadLeadsCsv();
    });
  }

  if (btnExportSummary) {
    btnExportSummary.addEventListener('click', () => {
      if (exportDropdown) exportDropdown.classList.remove('open');
      downloadSummaryCsv();
    });
  }

  if (btnExportTelemetry) {
    btnExportTelemetry.addEventListener('click', () => {
      if (exportDropdown) exportDropdown.classList.remove('open');
      downloadTelemetryCsv();
    });
  }

  if (btnQuickExportLeads) {
    btnQuickExportLeads.addEventListener('click', downloadLeadsCsv);
  }
}

// Initialize
async function init() {
  const user = await restoreSession();
  if (!user) return; // restoreSession already redirected to login on failure

  // Render Logged-in User Profile in Header
  const userBadge = document.getElementById('user-profile-badge');
  const userName = document.getElementById('header-user-name');
  const userRole = document.getElementById('header-user-role');

  if (userBadge && userName && userRole) {
    userName.textContent = user.name || user.email.split('@')[0];
    const roleName = (user.role || 'viewer').toUpperCase();
    userRole.textContent = roleName;
    userRole.className = `role-badge ${user.role === 'admin' ? 'role-admin' : 'role-viewer'}`;
    userBadge.style.display = 'inline-flex';
  }

  // Admin-only components display control
  const isUserAdmin = isAdmin();
  const usersPanel = document.querySelector('.users-panel');
  if (usersPanel) {
    usersPanel.style.display = isUserAdmin ? '' : 'none';
  }

  const exportDropdown = document.getElementById('admin-export-dropdown');
  if (exportDropdown) {
    exportDropdown.style.display = isUserAdmin ? 'inline-block' : 'none';
  }

  document.querySelectorAll('.admin-only-action').forEach((el) => {
    el.style.display = isUserAdmin ? 'flex' : 'none';
  });

  setupExportListeners();
  setupQuickActionListeners();
  loadDashboard();
}

init();
