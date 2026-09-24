import { useMemo, useState } from 'react';
import BtnGroup from './BtnGroup.jsx';
import Avatar from './Avatar.jsx';
import { ROLE_BADGE_CLASS } from './ProfileMenu.jsx';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'admin', label: 'Admins' },
  { value: 'viewer', label: 'Viewers' },
];

const SORTS = [
  { value: 'newest', label: 'Newest' },
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

  const makeAdmin = user.role !== 'admin';
  return (
    <button
      className={`btn btn-sm ${makeAdmin ? 'btn-primary' : 'btn-danger-light'}`}
      onClick={() => onToggleRole(user._id, makeAdmin ? 'admin' : 'viewer')}
    >
      {makeAdmin ? 'Make Admin' : 'Remove Admin'}
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
    <section className="card">
      <div className="card-header">
        <div>
          <h2>Registered Users & Access Roles</h2>
          <p>{users.length} {users.length === 1 ? 'account' : 'accounts'} with dashboard access</p>
        </div>
        <div className="card-actions">
          <span className="label">Role</span>
          <BtnGroup options={FILTERS} value={filter} onChange={setFilter} />
          <span className="label">Sort</span>
          <BtnGroup options={SORTS} value={sort} onChange={setSort} />
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Date Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty">No users match this filter.</td>
              </tr>
            ) : (
              visible.map((user) => (
                <tr key={user._id}>
                  <td>
                    <div className="cell-user">
                      <Avatar user={user} src={user.avatar} size={32} />
                      {user.name || 'Campus Member'}
                    </div>
                  </td>
                  <td className="cell-muted">{user.email}</td>
                  <td>
                    <span className={`badge ${ROLE_BADGE_CLASS[user.role] || 'badge-viewer'}`}>{user.role || 'viewer'}</span>
                  </td>
                  <td className="cell-muted">{new Date(user.createdAt).toLocaleDateString()}</td>
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
      </div>
    </section>
  );
}
