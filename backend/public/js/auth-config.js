/**
 * Microsoft Entra ID (Azure AD) sign-in configuration.
 *
 * Fill in clientId/tenantId once the App Registration is approved (see Chris).
 * Until then, MS_CONFIG.clientId stays empty and login.js disables the
 * "Sign in with Microsoft" button instead of trying to use it.
 */
export const MS_CONFIG = {
  clientId: '8942a4e9-dd74-463e-ad2b-251c244e4146', // Entra ID App Registration (Application) ID
  tenantId: 'ea1a909b-6600-4a25-82a5-0c6ed7d0513b', // Belgium Campus Entra ID tenant ID
  redirectUri: window.location.origin + window.location.pathname,
};
