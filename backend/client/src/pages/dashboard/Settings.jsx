import { useRef, useState } from 'react';
import Avatar from '../../components/Avatar.jsx';
import Icon from '../../components/Icon.jsx';
import PhotoEditor from '../../components/PhotoEditor.jsx';
import { ROLE_BADGE_CLASS, displayName } from '../../components/ProfileMenu.jsx';
import { loadImage, loadImageFile, saveAvatar, removeAvatar } from '../../lib/avatar.js';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System', icon: 'monitor' },
];

/**
 * Account settings: profile picture and light/dark mode.
 */
export default function Settings({ user, avatar, onAvatarChange, themeChoice, onThemeChoice }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success'|'danger', text }
  const [editing, setEditing] = useState(null); // <img> being adjusted in the photo editor

  const run = async (action, successText) => {
    setBusy(true);
    setMessage(null);
    try {
      onAvatarChange(await action());
      setMessage({ type: 'success', text: successText });
      return true;
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Something went wrong.' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openEditor = async (load) => {
    setMessage(null);
    try {
      setEditing(await load());
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (file) openEditor(() => loadImageFile(file));
  };

  const handleSave = async (makeDataUrl) => {
    const ok = await run(async () => saveAvatar(makeDataUrl()), 'Profile picture updated.');
    if (ok) setEditing(null);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <div className="breadcrumb">Home / <b>Settings</b></div>
        </div>
      </div>

      <div className="settings-grid">
        <section className="card">
          <div className="card-header">
            <div>
              <h2>Profile</h2>
              <p>How you appear in the dashboard</p>
            </div>
          </div>
          <div className="card-body">
            {message && (
              <div className={`alert alert-${message.type}`}>
                <Icon name={message.type === 'success' ? 'check' : 'x'} size={16} />
                {message.text}
              </div>
            )}

            <div className="profile-photo">
              <Avatar user={user} src={avatar} size={96} />
              <div className="profile-photo-actions">
                <div className="buttons">
                  <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
                    <Icon name="camera" size={15} />
                    {avatar ? 'Change photo' : 'Upload photo'}
                  </button>
                  {avatar && (
                    <button className="btn btn-light" onClick={() => openEditor(() => loadImage(avatar))} disabled={busy}>
                      <Icon name="crop" size={15} />
                      Adjust
                    </button>
                  )}
                  {avatar && (
                    <button
                      className="btn btn-danger-light"
                      onClick={() => run(removeAvatar, 'Profile picture removed.')}
                      disabled={busy}
                    >
                      <Icon name="trash" size={15} />
                      Remove
                    </button>
                  )}
                </div>
                <span className="hint">JPG, PNG or WebP. You can move and zoom it before saving.</span>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFile} />
              </div>
            </div>

            <dl className="detail-list">
              <div className="detail-row">
                <dt>Name</dt>
                <dd>{displayName(user)}</dd>
              </div>
              <div className="detail-row">
                <dt>Email</dt>
                <dd>{user.email}</dd>
              </div>
              <div className="detail-row">
                <dt>Role</dt>
                <dd>
                  <span className={`badge ${ROLE_BADGE_CLASS[user.role] || 'badge-viewer'}`}>{user.role || 'viewer'}</span>
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2>Appearance</h2>
              <p>Saved on this device</p>
            </div>
          </div>
          <div className="card-body">
            <div className="theme-options" role="radiogroup" aria-label="Theme">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  role="radio"
                  aria-checked={themeChoice === opt.value}
                  className={`theme-option${themeChoice === opt.value ? ' selected' : ''}`}
                  onClick={() => onThemeChoice(opt.value)}
                >
                  <span className="check">
                    <Icon name="check" size={12} />
                  </span>
                  <span className={`theme-preview preview-${opt.value}`}>
                    <span className="p-nav" />
                    <span className="p-body">
                      <span className="p-head" />
                      <span className="p-card" />
                    </span>
                  </span>
                  <span className="theme-option-label">
                    <Icon name={opt.icon} size={15} />
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      {editing && (
        <PhotoEditor
          image={editing}
          saving={busy}
          error={message?.type === 'danger' ? message.text : ''}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </>
  );
}
