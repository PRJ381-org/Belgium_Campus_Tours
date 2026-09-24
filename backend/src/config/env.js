// Central config. No side effects (safe to import in tests).
module.exports = {
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI, // validated in connectDb()
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  JWT_SECRET: process.env.JWT_SECRET, // validated in utils/jwt.js
  MS_CLIENT_ID: process.env.MS_CLIENT_ID, // Entra ID App Registration client ID
  MS_TENANT_ID: process.env.MS_TENANT_ID, // Belgium Campus Entra ID tenant ID
};
