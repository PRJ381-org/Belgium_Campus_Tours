import { useEffect, useState } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { login, loginWithMicrosoft } from '../lib/auth.js';
import { MS_CONFIG } from '../lib/authConfig.js';

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

export default function Login() {
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Coming back from a Microsoft redirect? Finish the sign-in.
  useEffect(() => {
    if (!msConfigured) return;
    getMsal()
      .then((msal) => msal.handleRedirectPromise())
      .then(async (result) => {
        if (result && result.idToken) {
          await loginWithMicrosoft(result.idToken);
          window.location.href = 'dashboard.html';
        }
      })
      .catch((err) => setError(`Microsoft sign-in failed: ${err.message}`));
  }, []);

  const handleMicrosoftLogin = async () => {
    const msal = await getMsal();
    msal.loginRedirect({ scopes: ['openid', 'profile', 'email'] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      window.location.href = 'dashboard.html';
    } catch (err) {
      setError(err.message || 'Sign in failed');
    }
  };

  return (
    <div className="login-wrap">
      <a href="index.html" className="back-to-home">← Back to Home</a>
      <div className="login-card panel">
        <div className="login-brand">
          <img src="assets/logo.png" alt="Belgium Campus" className="brand-logo" />
          <div>
            <h1>Virtual Campus Open Day</h1>
            <span className="brand-subtitle">Admin Dashboard</span>
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <button className="btn-ms-signin" type="button" disabled={!msConfigured} onClick={handleMicrosoftLogin}>
          <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
          </svg>
          <span>Sign in with Microsoft</span>
        </button>
        {!msConfigured && (
          <p className="login-note">
            Microsoft sign-in isn't configured yet — pending App Registration approval.
          </p>
        )}

        <div className="login-divider"><span>or</span></div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit" className="btn-refresh login-submit">Sign in</button>
        </form>
      </div>
    </div>
  );
}
