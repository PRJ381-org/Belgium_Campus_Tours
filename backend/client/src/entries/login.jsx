import { createRoot } from 'react-dom/client';
import '../styles/global.css';
import { isAuthenticated } from '../lib/auth.js';
import Login from '../pages/Login.jsx';

// Already signed in? Skip straight to the dashboard.
if (isAuthenticated()) {
  window.location.href = 'dashboard.html';
} else {
  createRoot(document.getElementById('root')).render(<Login />);
}
