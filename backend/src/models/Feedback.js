const mongoose = require('mongoose');

const VISITOR_TYPES = ['prospective_student', 'parent', 'other'];
const PLATFORMS = ['vr', 'pc', 'android', 'none'];
// Where the feedback came from: the website form, responses imported from the
// old Google Form, or (later) the VR tour itself.
const SOURCES = ['website', 'google_form', 'vr'];

/**
 * Open Day feedback, submitted from the public landing page form.
 * Name and email are required so the team can follow up on a response.
 */
const feedbackSchema = new mongoose.Schema(
  {
    rating: { type: Number, required: true, min: 1, max: 5 },
    visitorType: { type: String, enum: VISITOR_TYPES },
    platform: { type: String, enum: PLATFORMS },
    liked: { type: String, trim: true, maxlength: 1000, default: '' },
    improve: { type: String, trim: true, maxlength: 1000, default: '' },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    source: { type: String, enum: SOURCES, default: 'website' },
  },
  { timestamps: true }
);

feedbackSchema.index({ createdAt: -1 });

const Feedback = mongoose.model('Feedback', feedbackSchema);
Feedback.VISITOR_TYPES = VISITOR_TYPES;
Feedback.PLATFORMS = PLATFORMS;
module.exports = Feedback;
