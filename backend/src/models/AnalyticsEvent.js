const mongoose = require('mongoose');

// Adding to this list is safe; removing or renaming is not. The enum is
// validated on write, so a client sending a type absent here gets a 400 and the
// event is lost for good - keep it a superset of what any shipped build emits.
const EVENT_TYPES = [
  'session_start',
  'session_end',
  'area_enter',
  'area_exit',
  'hotspot_view',
  'info_request',
  'objective_complete',
  'game_download',
];

// Anonymous engagement telemetry. sessionId comes from Firebase anonymous auth;
// no PII stored here.
const analyticsEventSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, trim: true, index: true },
    eventType: { type: String, required: true, enum: EVENT_TYPES },
    area: { type: String, trim: true },
    hotspotId: { type: String, trim: true },
    durationMs: { type: Number, min: 0 },
    seq: { type: Number, index: true }, // client fire-order, for deterministic sorting
    // Build provenance. All optional, because the shipped client sends none of
    // them. Without these, telemetry from a Quest build and a Windows build is
    // indistinguishable, so "did the Android build actually work on the day?"
    // becomes unanswerable after the fact.
    platform: { type: String, trim: true },
    buildId: { type: String, trim: true },
    appVersion: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

analyticsEventSchema.index({ eventType: 1, createdAt: -1 });

const AnalyticsEvent = mongoose.model('AnalyticsEvent', analyticsEventSchema);
AnalyticsEvent.EVENT_TYPES = EVENT_TYPES;
module.exports = AnalyticsEvent;
