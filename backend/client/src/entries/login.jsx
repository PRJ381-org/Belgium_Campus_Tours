import { createRoot } from 'react-dom/client';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '../styles/base.css';
import '../styles/login.css';
import { isAuthenticated } from '../lib/auth.js';
import Login from '../pages/Login.jsx';

// The sign-in page is always dark (the dashboard keeps its own light/dark setting).
document.documentElement.dataset.theme = 'dark';

// Already signed in? Skip straight to the dashboard.
if (isAuthenticated()) {
  window.location.href = 'dashboard.html';
} else {
  createRoot(document.getElementById('root')).render(<Login />);
}
