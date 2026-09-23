import { useMemo, useState } from 'react';
import BtnGroup from './BtnGroup.jsx';
import { ROLE_BADGE_CLASS } from './Topbar.jsx';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'admin', label: 'Admins' },
  { value: 'viewer', label: 'Viewers' },
];

const SORTS = [
  { value: 'newest', label: 'Newest ⬇' },
  { value: 'name', label: 'Name A-Z' },
];

const SORTERS = {
  newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  name: (a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''),
};

function RoleAction({ user, currentUserId, canManageRoles, onToggleRole }) {
  if (user.role === 'master') return <span className="action-note">Master account</span>;
  if (user._id === currentUserId) return <span className="action-note">This is you</span>;
  if (!canManageRoles) return <span className="action-note">—</span>;

  const nextRole = user.role === 'admin' ? 'viewer' : 'admin';
  return (
    <button className="btn-chip btn-role-toggle" onClick={() => onToggleRole(user._id, nextRole)}>
      {user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
    </button>
  );
}

/**
 * Admin-only table of registered users. Masters can promote/demote admins.
 */
export default function UsersPanel({ users, currentUserId, canManageRoles, onToggleRole }) {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');

  const visible = useMemo(() => {
    const filtered = filter === 'all' ? [...users] : users.filter((u) => u.role === filter);
    return filtered.sort(SORTERS[sort]);
  }, [users, filter, sort]);

  return (
    <section className="panel users-panel">
      <div className="panel-header">
        <h2>Registered Users & Access Roles</h2>
        <div className="quick-actions">
          <div className="action-group">
            <span className="action-label">Role:</span>
            <BtnGroup options={FILTERS} value={filter} onChange={setFilter} />
          </div>
          <div className="action-group">
            <span className="action-label">Sort:</span>
            <BtnGroup options={SORTS} value={sort} onChange={setSort} />
          </div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>User / Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Date Added</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td colSpan={5}>No registered users found.</td>
            </tr>
          ) : (
            visible.map((user) => (
              <tr key={user._id}>
                <td><strong>{user.name || 'Campus Member'}</strong></td>
                <td>{user.email}</td>
                <td>
                  <span className={`role-badge ${ROLE_BADGE_CLASS[user.role] || 'role-viewer'}`}>
                    {user.role || 'viewer'}
                  </span>
                </td>
                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                <td>
                  <RoleAction
                    user={user}
                    currentUserId={currentUserId}
                    canManageRoles={canManageRoles}
                    onToggleRole={onToggleRole}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
