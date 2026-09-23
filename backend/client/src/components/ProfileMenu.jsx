import { useCallback, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';
import useClickOutside from './useClickOutside.js';

export const ROLE_BADGE_CLASS = { master: 'badge-master', admin: 'badge-admin', viewer: 'badge-viewer' };

export function displayName(user) {
  return user?.name || user?.email?.split('@')[0] || 'User';
}

/**
 * Header avatar button with a dropdown: who's signed in, Settings, Sign out.
 */
export default function ProfileMenu({ user, avatar, onNavigate, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, useCallback(() => setOpen(false), []));

  const go = (page) => {
    setOpen(false);
    onNavigate(page);
  };

  return (
    <div className="dropdown" ref={ref}>
      <button className="profile-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Avatar user={user} src={avatar} size={34} />
        <span className="profile-name">{displayName(user)}</span>
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div className="dropdown-menu">
          <div className="profile-head">
            <Avatar user={user} src={avatar} size={42} />
            <div>
              <strong>{displayName(user)}</strong>
              <span>{user.email}</span>
              <span className={`badge ${ROLE_BADGE_CLASS[user.role] || 'badge-viewer'}`} style={{ marginTop: 6, display: 'inline-flex' }}>
                {user.role || 'viewer'}
              </span>
            </div>
          </div>
          <div className="dropdown-divider" />
          <button className="dropdown-item" onClick={() => go('settings')}>
            <Icon name="settings" size={16} />
            Settings
          </button>
          <button className="dropdown-item" onClick={onLogout}>
            <Icon name="logout" size={16} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
