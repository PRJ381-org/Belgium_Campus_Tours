const express = require('express');
const { body, param } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../utils/validate');
const Ticket = require('../models/Ticket');
const {
  createTicket,
  myTickets,
  visitorReply,
  lookupTicket,
  listTickets,
  ticketStats,
  staffReply,
  setStatus,
} = require('../controllers/tickets.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const requireDb = require('../middlewares/requireDb');

const router = express.Router();
const staff = [requireAuth, requireRole(['admin', 'master'])];

// Creating tickets and replying: loose enough for a room of visitors on one
// NAT'd IP, far too low to be worth spamming.
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many messages. Please wait a moment and try again.' },
});

// The inbox polls this while open, so it gets a much higher ceiling.
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

// Guessing ref + email pairs is the one brute-force target here. Only FAILED
// lookups count, so a genuine visitor is never locked out by their own success.
const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
});

const refParam = param('ref').isString().trim().toUpperCase().matches(/^VC-[A-Z0-9]{6}$/).withMessage('Invalid ticket reference');
const messageBody = body('message')
  .isString()
  .withMessage('Please write a message')
  .trim()
  .notEmpty()
  .withMessage('Please write a message')
  .isLength({ max: 2000 })
  .withMessage('Keep messages under 2000 characters');

// ---------- Visitor (public) ----------

router.post(
  '/',
  writeLimiter,
  [
    body('name').isString().trim().notEmpty().withMessage('Please enter your name').isLength({ max: 100 }),
    body('email').isEmail().withMessage('Please enter a valid email address').isLength({ max: 200 }).normalizeEmail(),
    body('category').isIn(Ticket.CATEGORIES).withMessage('Please choose what your issue is about'),
    body('platform').optional({ values: 'falsy' }).isIn(Ticket.PLATFORMS).withMessage('Invalid platform'),
    body('subject')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Please add a short subject')
      .isLength({ max: 120 })
      .withMessage('Keep the subject under 120 characters'),
    messageBody,
    body('website').optional().isString(), // honeypot
  ],
  validate,
  requireDb,
  createTicket
);

router.post(
  '/mine',
  readLimiter,
  [body('tickets').isArray({ max: 20 }).withMessage('tickets must be a list')],
  validate,
  requireDb,
  myTickets
);

router.post(
  '/lookup',
  lookupLimiter,
  [
    body('ref').isString().trim().toUpperCase().matches(/^VC-[A-Z0-9]{6}$/).withMessage('That reference should look like VC-7K3P9Q'),
    body('email').isEmail().withMessage('Please enter a valid email address').normalizeEmail(),
  ],
  validate,
  requireDb,
  lookupTicket
);

router.post(
  '/:ref/messages',
  writeLimiter,
  [refParam, body('key').isString().notEmpty(), messageBody],
  validate,
  requireDb,
  visitorReply
);

// ---------- Staff (dashboard) ----------

router.get('/', ...staff, requireDb, listTickets);
router.get('/stats', ...staff, requireDb, ticketStats);
router.post('/:ref/reply', ...staff, [refParam, messageBody], validate, requireDb, staffReply);
router.patch(
  '/:ref/status',
  ...staff,
  [refParam, body('status').isIn(Ticket.STATUSES).withMessage('Invalid status')],
  validate,
  requireDb,
  setStatus
);

module.exports = router;
