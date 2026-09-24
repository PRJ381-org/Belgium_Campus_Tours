const Feedback = require('../models/Feedback');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/feedback -> store a feedback form submission (public)
exports.createFeedback = asyncHandler(async (req, res) => {
  // Honeypot: the form has a hidden "website" field that people never see.
  // Bots fill every field, so answer as if it worked and store nothing.
  if (req.body.website) {
    return res.status(201).json({ success: true });
  }

  const { rating, visitorType, platform, liked, improve, name, email } = req.body;
  const feedback = await Feedback.create({
    rating,
    // An unanswered choice arrives as '' - store it as "not given", not as an invalid enum value.
    visitorType: visitorType || undefined,
    platform: platform || undefined,
    liked,
    improve,
    name,
    email,
  });
  res.status(201).json({ success: true, id: feedback._id });
});

// GET /api/feedback -> newest first, for the admin Feedback page
exports.listFeedback = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
  const feedback = await Feedback.find().sort({ createdAt: -1 }).limit(limit);
  res.json({ success: true, count: feedback.length, feedback });
});
