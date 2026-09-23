import { createRoot } from 'react-dom/client';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '../styles/base.css';
import '../styles/dashboard.css';
import { isAuthenticated } from '../lib/auth.js';
import { applyTheme } from '../lib/theme.js';
import Dashboard from '../pages/Dashboard.jsx';

// Set light/dark before the first paint so the page doesn't flash the wrong theme.
applyTheme();

// Bail out to the login page immediately if there's no session at all.
if (!isAuthenticated()) {
  window.location.href = 'login.html';
} else {
  createRoot(document.getElementById('root')).render(<Dashboard />);
}
