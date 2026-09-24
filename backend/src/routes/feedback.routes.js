const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../utils/validate');
const { createFeedback, listFeedback } = require('../controllers/feedback.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const requireDb = require('../middlewares/requireDb');
const Feedback = require('../models/Feedback');

const router = express.Router();

// Loose for the same reason as leads: on open day a whole room of visitors can
// share one NAT'd IP. Still far too low to be useful to a spam script.
const feedbackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many submissions. Please try again shortly.' },
});

// POST /api/feedback -> public feedback form on the landing page
router.post(
  '/',
  feedbackLimiter,
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Please choose a rating from 1 to 5').toInt(),
    body('visitorType').optional({ values: 'falsy' }).isIn(Feedback.VISITOR_TYPES).withMessage('Invalid visitor type'),
    body('platform').optional({ values: 'falsy' }).isIn(Feedback.PLATFORMS).withMessage('Invalid platform'),
    body('liked').optional().isString().trim().isLength({ max: 1000 }).withMessage('Keep answers under 1000 characters'),
    body('improve').optional().isString().trim().isLength({ max: 1000 }).withMessage('Keep answers under 1000 characters'),
    body('name')
      .isString()
      .withMessage('Please enter your name')
      .trim()
      .notEmpty()
      .withMessage('Please enter your name')
      .isLength({ max: 100 })
      .withMessage('Name is too long'),
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email address')
      .isLength({ max: 200 })
      .withMessage('Email is too long')
      .normalizeEmail(),
    body('website').optional().isString(), // honeypot - see the controller
  ],
  validate,
  requireDb,
  createFeedback
);

// GET /api/feedback -> all responses (admin/master)
router.get('/', requireAuth, requireRole(['admin', 'master']), requireDb, listFeedback);

module.exports = router;
