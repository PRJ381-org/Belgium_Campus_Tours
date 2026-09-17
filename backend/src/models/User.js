const mongoose = require('mongoose');

// 'master' is a top-tier role that manages who else is an admin. It is never
// assignable through the API/UI - only via a direct database change (see
// src/scripts/setRole.js) - so a compromised admin session can never mint one.
const ROLES = ['viewer', 'admin', 'master'];

/**
 * User schema for dashboard authentication and RBAC.
 */
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
    },
    name: {
      type: String,
      trim: true,
      default: '',
    },
    role: {
      type: String,
      enum: ROLES,
      default: 'viewer',
    },
    provider: {
      type: String,
      enum: ['local', 'microsoft'],
      default: 'local',
    },
  },
  { timestamps: true }
);

userSchema.statics.ROLES = ROLES;

module.exports = mongoose.model('User', userSchema);
