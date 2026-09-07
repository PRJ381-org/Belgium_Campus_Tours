import { login, loginWithMicrosoft, isAuthenticated } from './auth.js';
import { MS_CONFIG } from './auth-config.js';

// Already signed in? Skip straight to the dashboard.
if (isAuthenticated()) {
  window.location.href = 'dashboard.html';
}

const btnMsLogin = document.getElementById('btn-ms-login');
const msDisabledNote = document.getElementById('ms-disabled-note');
const errorBanner = document.getElementById('login-error');
const localForm = document.getElementById('local-login-form');

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.style.display = 'block';
}

let msalInstance = null;

async function initMicrosoftSignIn() {
  if (!MS_CONFIG.clientId || !MS_CONFIG.tenantId) {
    btnMsLogin.disabled = true;
    msDisabledNote.style.display = 'block';
    return;
  }

  msalInstance = new msal.PublicClientApplication({
    auth: {
      clientId: MS_CONFIG.clientId,
      authority: `https://login.microsoftonline.com/${MS_CONFIG.tenantId}`,
      redirectUri: MS_CONFIG.redirectUri,
    },
    cache: { cacheLocation: 'sessionStorage' },
  });
  await msalInstance.initialize();

  // Coming back from a Microsoft redirect? Finish the sign-in.
  try {
    const result = await msalInstance.handleRedirectPromise();
    if (result && result.idToken) {
      await loginWithMicrosoft(result.idToken);
      window.location.href = 'dashboard.html';
      return;
    }
  } catch (err) {
    showError(`Microsoft sign-in failed: ${err.message}`);
  }

  btnMsLogin.addEventListener('click', () => {
    msalInstance.loginRedirect({ scopes: ['openid', 'profile', 'email'] });
  });
}

localForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    await login(email, password);
    window.location.href = 'dashboard.html';
  } catch (err) {
    showError(err.message || 'Sign in failed');
  }
});

initMicrosoftSignIn();
