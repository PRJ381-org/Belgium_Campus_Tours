import { createRoot } from 'react-dom/client';
import '../styles/global.css';
import { isAuthenticated } from '../lib/auth.js';
import Dashboard from '../pages/Dashboard.jsx';

// Bail out to the login page immediately if there's no session at all.
if (!isAuthenticated()) {
  window.location.href = 'login.html';
} else {
  createRoot(document.getElementById('root')).render(<Dashboard />);
}
