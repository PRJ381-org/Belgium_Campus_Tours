const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const { signSessionToken } = require('../utils/jwt');
const { verifyMicrosoftIdToken } = require('../utils/microsoftAuth');

/**
 * POST /api/auth/login
 * Handles user login and returns JWT session token with role information.
 */
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email, provider: 'local' }).select('+password');
  if (!user || !user.password) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  const token = signSessionToken(user);
  res.json({
    success: true,
    token,
    user: { email: user.email, name: user.name, role: user.role },
  });
});

/**
 * POST /api/auth/microsoft
 * Exchanges a verified Microsoft Entra ID token for a session JWT.
 * Auto-provisions a User record (role: viewer) on first sign-in.
 */
exports.microsoftLogin = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ success: false, message: 'idToken is required' });
  }

  let decoded;
  try {
    decoded = await verifyMicrosoftIdToken(idToken);
  } catch (err) {
    return res.status(401).json({ success: false, message: `Microsoft sign-in failed: ${err.message}` });
  }

  const email = (decoded.preferred_username || decoded.email || '').toLowerCase();
  if (!email) {
    return res.status(401).json({ success: false, message: 'Microsoft account has no email claim' });
  }

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      email,
      name: decoded.name || '',
      provider: 'microsoft',
      role: 'viewer',
    });
  }

  const token = signSessionToken(user);
  res.json({
    success: true,
    token,
    user: { email: user.email, name: user.name, role: user.role },
  });
});

/**
 * GET /api/auth/me
 * Returns information for currently authenticated user.
 */
exports.me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

/**
 * GET /api/auth/me/avatar
 * Returns the signed-in user's profile picture ('' when none is set).
 */
exports.getMyAvatar = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('+avatar');
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  res.json({ success: true, avatar: user.avatar || '' });
});

/**
 * PUT /api/auth/me/avatar
 * Sets the signed-in user's profile picture. The route validator guarantees a
 * small base64 PNG/JPEG/WebP data URL.
 */
exports.setMyAvatar = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user.id, { avatar: req.body.avatar }, { new: true }).select('+avatar');
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  res.json({ success: true, avatar: user.avatar });
});

/**
 * DELETE /api/auth/me/avatar
 * Removes the signed-in user's profile picture.
 */
exports.deleteMyAvatar = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user.id, { avatar: '' });
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  res.json({ success: true, avatar: '' });
});

/**
 * GET /api/auth/users
 * Returns list of registered dashboard users from MongoDB (excluding password
 * hashes), including profile pictures so the admin Users table can show them.
 * Avatars are small (256px, under ~90k chars each) and this is admin-only.
 */
exports.listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select('-password +avatar').sort({ createdAt: -1 });
  res.json({
    success: true,
    count: users.length,
    users,
  });
});

/**
 * PATCH /api/auth/users/:id/role
 * Promotes or demotes a user between 'viewer' and 'admin' (master only).
 * 'master' itself is never settable here - see the route's validator.
 */
exports.updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['viewer', 'admin'].includes(role)) {
    return res.status(400).json({ success: false, message: "Role must be 'viewer' or 'admin'" });
  }

  const target = await User.findById(req.params.id);
  if (!target) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (target.role === 'master') {
    return res.status(400).json({ success: false, message: 'Master accounts cannot be changed here.' });
  }

  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  res.json({ success: true, user });
});
