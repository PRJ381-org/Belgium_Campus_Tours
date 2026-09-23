/**
 * Dashboard sidebar navigation (Home / ...). Pure UI state - the parent decides
 * which page is shown.
 */
const PAGES = [
  {
    id: 'home',
    label: 'Home',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
];

export default function Sidebar({ page, onNavigate }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <img src="assets/logo.png" alt="Belgium Campus" className="sidebar-logo" />
      </div>
      <div className="sidebar-nav">
        {PAGES.map((p) => (
          <button
            key={p.id}
            className={`sidebar-link${page === p.id ? ' active' : ''}`}
            onClick={() => onNavigate(p.id)}
          >
            {p.icon}
            <span className="sidebar-label">{p.label}</span>
            <span className="sidebar-glow" />
          </button>
        ))}
      </div>
    </nav>
  );
}
