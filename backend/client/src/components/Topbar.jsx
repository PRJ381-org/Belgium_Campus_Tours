import ExportDropdown from './ExportDropdown.jsx';

export const ROLE_BADGE_CLASS = { master: 'role-master', admin: 'role-admin', viewer: 'role-viewer' };

/**
 * Dashboard header: title, connection status, signed-in user, export, refresh, sign out.
 */
export default function Topbar({ user, isAdmin, online, refreshing, onRefresh, onLogout }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-info">
          <h1>Virtual Campus Open Day</h1>
          <span className="brand-subtitle">VR Analytics & Telemetry</span>
        </div>
      </div>
      <div className="header-actions">
        <div className="status-indicator">
          <span className={`status-dot${online ? '' : ' offline'}`} />
          <span className="status-text">{online ? 'Live' : 'Offline'}</span>
        </div>

        {user && (
          <div className="user-profile-badge">
            <div className="user-avatar">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span className="header-user-name">{user.name || user.email.split('@')[0]}</span>
            <span className={`role-badge ${ROLE_BADGE_CLASS[user.role] || 'role-viewer'}`}>
              {(user.role || 'viewer').toUpperCase()}
            </span>
          </div>
        )}

        {isAdmin && <ExportDropdown />}

        <button
          className="btn-refresh"
          title="Refresh data"
          style={{ opacity: refreshing ? 0.6 : 1 }}
          onClick={onRefresh}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          <span>Refresh</span>
        </button>
        <button className="btn-refresh" title="Sign out" onClick={onLogout}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Sign out</span>
        </button>
      </div>
    </header>
  );
}
