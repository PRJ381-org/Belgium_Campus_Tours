import Icon from './Icon.jsx';

/**
 * Dashboard sidebar navigation. Collapses to icons on desktop and slides in
 * as an overlay on mobile (both controlled by the parent via .app classes).
 */
export default function Sidebar({ sections, page, onNavigate }) {
  return (
    <nav className="sidebar" aria-label="Dashboard navigation">
      <div className="sidebar-brand">
        <img src="assets/logo.png" alt="Belgium Campus" />
        <span className="sidebar-brand-text">
          <strong>Virtual Campus Open Day</strong>
          <small>VR Analytics & Telemetry</small>
        </span>
      </div>
      <div className="sidebar-nav">
        {sections.map((section) => (
          <div key={section.caption}>
            <div className="nav-caption">{section.caption}</div>
            {section.items.map((item) => (
              <button
                key={item.id}
                className={`nav-link${page === item.id ? ' active' : ''}`}
                onClick={() => onNavigate(item.id)}
                title={item.label}
                aria-current={page === item.id ? 'page' : undefined}
              >
                <span className="nav-icon">
                  <Icon name={item.icon} size={16} />
                </span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}
