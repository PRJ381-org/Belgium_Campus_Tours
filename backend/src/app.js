const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { CORS_ORIGIN, NODE_ENV } = require('./config/env');

const path = require('path');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const leadsRoutes = require('./routes/leads.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const exportRoutes = require('./routes/export.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const downloadRoutes = require('./routes/download.routes');
const notFound = require('./utils/notFound');
const errorHandler = require('./utils/errorHandler');

const app = express();

// Azure App Service terminates TLS at a front end and forwards over one hop.
// Without this, req.ip is the front end's address for every request, so
// express-rate-limit buckets all traffic into a single counter and a room full
// of headsets shares one quota.
app.set('trust proxy', 1);

// CORS_ORIGIN is a comma-separated allowlist. A literal "*" disables the
// allowlist entirely. Requests without an Origin header (the Unreal client,
// curl, server-to-server) are always allowed - CORS only governs browsers.
const allowedOrigins = CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = allowedOrigins.includes('*')
  ? { origin: '*' }
  : { origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)) };

// Default CSP blocks the CDN scripts the dashboard depends on (Chart.js, MSAL) -
// explicitly allow jsdelivr for scripts, plus Microsoft's endpoints for sign-in.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", 'https://cdn.jsdelivr.net'],
        'connect-src': ["'self'", 'https://login.microsoftonline.com'],
      },
    },
  })
);
app.use(cors(corsOptions));
app.use(express.json({ limit: '100kb' }));
if (NODE_ENV !== 'test') app.use(morgan('dev'));

// API routes are mounted before the static handler so nothing dropped into
// public/ can ever shadow an endpoint.
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/downloads', downloadRoutes);

// The web portal and dashboard live inside backend/public.
app.use(express.static(path.join(__dirname, '..', 'public')));

// Redirect legacy /dashboard URLs to /
app.get(['/dashboard', '/dashboard/*'], (req, res) => res.redirect(302, '/'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
