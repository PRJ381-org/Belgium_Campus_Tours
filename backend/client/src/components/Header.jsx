import Icon from './Icon.jsx';
import ProfileMenu from './ProfileMenu.jsx';

/**
 * Gradient top bar: sidebar toggle, connection status, theme toggle, profile menu.
 */
export default function Header({ user, avatar, online, theme, onToggleTheme, onToggleSidebar, onNavigate, onLogout }) {
  return (
    <header className="header">
      <button className="icon-btn" onClick={onToggleSidebar} aria-label="Toggle menu">
        <Icon name="menu" size={20} />
      </button>
      <div className="header-spacer" />
      <div className={`status-pill${online ? '' : ' offline'}`} title={online ? 'Connected to the backend' : 'Backend unreachable'}>
        <span className="status-dot" />
        <span className="status-text">{online ? 'Live' : 'Offline'}</span>
      </div>
      <button
        className="icon-btn"
        onClick={onToggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
      </button>
      {user && <ProfileMenu user={user} avatar={avatar} onNavigate={onNavigate} onLogout={onLogout} />}
    </header>
  );
}
