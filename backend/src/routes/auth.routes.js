const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../utils/validate');
const {
  login,
  microsoftLogin,
  me,
  getMyAvatar,
  setMyAvatar,
  deleteMyAvatar,
  listUsers,
  updateUserRole,
} = require('../controllers/auth.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const requireDb = require('../middlewares/requireDb');

const router = express.Router();

// Credential-stuffing brake. skipSuccessfulRequests is what makes a limit this
// tight safe: staff on campus all share one NAT'd IP, so a plain counter would
// let a few normal sign-ins lock everyone else out. Only FAILED attempts consume
// quota, which is exactly what an attacker generates and what a legitimate user
// generates very few of.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many failed login attempts. Try again in 15 minutes.' },
});

// POST /api/auth/login
router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  requireDb,
  login
);

// POST /api/auth/microsoft -> exchange a Microsoft Entra ID token for a session JWT
router.post(
  '/microsoft',
  [body('idToken').notEmpty().withMessage('idToken is required')],
  validate,
  requireDb,
  microsoftLogin
);

// GET /api/auth/me
// No requireDb: this echoes the verified JWT and never reads the database, so an
// already-signed-in user can still confirm their session during an outage.
router.get('/me', requireAuth, me);

// Profile picture for the signed-in user (any role). Stored as a data URL; the
// dashboard shrinks images to 256px first, so ~90k chars is plenty and keeps
// the body under express.json's 100kb limit.
const AVATAR_MAX_LENGTH = 90000;
const AVATAR_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

router.get('/me/avatar', requireAuth, requireDb, getMyAvatar);
router.put(
  '/me/avatar',
  requireAuth,
  [
    body('avatar')
      .isString()
      .isLength({ max: AVATAR_MAX_LENGTH })
      .withMessage('Image is too large')
      .matches(AVATAR_DATA_URL)
      .withMessage('Avatar must be a PNG, JPEG or WebP image'),
  ],
  validate,
  requireDb,
  setMyAvatar
);
router.delete('/me/avatar', requireAuth, requireDb, deleteMyAvatar);

// GET /api/auth/users -> list registered users and roles (admin/master)
router.get('/users', requireAuth, requireRole(['admin', 'master']), requireDb, listUsers);

// PATCH /api/auth/users/:id/role -> promote/demote a user (master only - see updateUserRole)
router.patch(
  '/users/:id/role',
  requireAuth,
  requireRole(['master']),
  [body('role').isIn(['viewer', 'admin']).withMessage("Role must be 'viewer' or 'admin'")],
  validate,
  requireDb,
  updateUserRole
);

module.exports = router;
