/**
 * Authentication and Role State Management Module.
 */
import { fetchJson } from './api.js';

let currentUser = null;

export function getCurrentUser() {
  return currentUser;
}

export function isAuthenticated() {
  return !!sessionStorage.getItem('token');
}

export function isAdmin() {
  return currentUser && (currentUser.role === 'admin' || currentUser.role === 'master');
}

// Only a master can promote/demote other users' admin access.
export function isMaster() {
  return currentUser && currentUser.role === 'master';
}

/**
 * Logs in with email/password and saves session token.
 */
export async function login(email, password) {
  const data = await fetchJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (data.token) {
    sessionStorage.setItem('token', data.token);
    currentUser = data.user;
  }
  return data;
}

/**
 * Exchanges a Microsoft Entra ID token for a dashboard session token.
 */
export async function loginWithMicrosoft(idToken) {
  const data = await fetchJson('/api/auth/microsoft', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });

  if (data.token) {
    sessionStorage.setItem('token', data.token);
    currentUser = data.user;
  }
  return data;
}

/**
 * Clears current session and logs out.
 */
export function logout() {
  sessionStorage.removeItem('token');
  currentUser = null;
  window.location.href = 'login.html';
}

/**
 * Redirects to the login page if there's no session token.
 * Call this as early as possible on pages that require auth.
 */
export function requireLogin() {
  if (!isAuthenticated()) {
    window.location.href = 'login.html';
  }
}

/**
 * Rehydrates currentUser (role, name, email) from the backend using the
 * stored token. Needed because currentUser only lives in memory and is lost
 * on every page reload, while the token itself persists in sessionStorage.
 * Logs out (and redirects to login) if the token is invalid or expired.
 */
export async function restoreSession() {
  if (!isAuthenticated()) return null;
  try {
    const data = await fetchJson('/api/auth/me');
    currentUser = data.user;
    return currentUser;
  } catch (err) {
    logout();
    return null;
  }
}
