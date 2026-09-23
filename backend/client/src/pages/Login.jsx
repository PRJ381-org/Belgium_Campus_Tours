import { useEffect, useState } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { login, loginWithMicrosoft } from '../lib/auth.js';
import { MS_CONFIG } from '../lib/authConfig.js';
import Icon from '../components/Icon.jsx';

const msConfigured = Boolean(MS_CONFIG.clientId && MS_CONFIG.tenantId);

// Created once per page load (outside the component) so React re-renders can't
// run MSAL's initialize/handleRedirectPromise twice.
let msalReady = null;
function getMsal() {
  if (!msalReady) {
    const instance = new PublicClientApplication({
      auth: {
        clientId: MS_CONFIG.clientId,
        authority: `https://login.microsoftonline.com/${MS_CONFIG.tenantId}`,
        redirectUri: MS_CONFIG.redirectUri,
      },
      cache: { cacheLocation: 'sessionStorage' },
    });
    msalReady = instance.initialize().then(() => instance);
  }
  return msalReady;
}

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export default function Login() {
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  // Coming back from a Microsoft redirect? Finish the sign-in.
  useEffect(() => {
    if (!msConfigured) return;
    getMsal()
      .then((msal) => msal.handleRedirectPromise())
      .then(async (result) => {
        if (result && result.idToken) {
          setBusy(true);
          await loginWithMicrosoft(result.idToken);
          window.location.href = 'dashboard.html';
        }
      })
      .catch((err) => {
        setBusy(false);
        setError(`Microsoft sign-in failed: ${err.message}`);
      });
  }, []);

  const handleMicrosoftLogin = async () => {
    const msal = await getMsal();
    msal.loginRedirect({ scopes: ['openid', 'profile', 'email'] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      window.location.href = 'dashboard.html';
    } catch (err) {
      setError(err.message || 'Sign in failed');
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <span className="auth-shape s1" />
      <span className="auth-shape s2" />
      <span className="auth-shape s3" />
      <span className="auth-shape s4" />
      <span className="auth-shape s5" />

      <div className="auth-topbar">
        <a href="index.html" className="back-link">
          <Icon name="arrowLeft" size={15} />
          Back to Home
        </a>
      </div>

      <main className="auth-card">
        <div className="auth-body">
          <div className="auth-brand">
            <img src="assets/logo.png" alt="Belgium Campus" />
            <div>
              <strong>Virtual Campus Open Day</strong>
              <span>VR Analytics &amp; Telemetry</span>
            </div>
          </div>

          <h1 className="auth-title">Sign in</h1>
          <p className="auth-subtitle">Welcome back! Sign in to open the admin dashboard.</p>

          {error && (
            <div className="alert alert-danger" role="alert">
              <Icon name="x" size={16} />
              {error}
            </div>
          )}

          <button
            className="btn-microsoft"
            type="button"
            disabled={!msConfigured || busy}
            onClick={handleMicrosoftLogin}
          >
            <MicrosoftLogo />
            Sign in with Microsoft
          </button>
          {!msConfigured && (
            <p className="auth-note">Microsoft sign-in isn't configured yet — pending App Registration approval.</p>
          )}

          <div className="auth-divider">or use your email</div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <div className="input-wrap">
                <Icon name="mail" size={16} />
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="you@belgiumcampus.ac.za"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input-wrap">
                <Icon name="lock" size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="reveal-btn"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
              {busy ? <span className="btn-spinner" /> : null}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <div className="auth-footer">Access is limited to Belgium Campus</div>
      </main>
    </div>
  );
}
