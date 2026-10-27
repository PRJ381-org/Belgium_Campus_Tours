const mongoose = require('mongoose');

const PLATFORMS = ['windows', 'android'];

/**
 * One click on a Download button on the landing page. No personal data - just
 * which build and when - so the dashboard can show how many people tried to
 * download each version.
 */
const downloadClickSchema = new mongoose.Schema(
  {
    platform: { type: String, enum: PLATFORMS, required: true },
  },
  { timestamps: true }
);

const DownloadClick = mongoose.model('DownloadClick', downloadClickSchema);
DownloadClick.PLATFORMS = PLATFORMS;
module.exports = DownloadClick;
