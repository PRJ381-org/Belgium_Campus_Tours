/**
 * Sets an EXISTING user's role directly, bypassing the API. This is the only
 * way to grant/revoke 'master' - it is deliberately not reachable through any
 * endpoint, so a compromised admin session can never mint one.
 * Usage: node src/scripts/setRole.js <email> <viewer|admin|master>
 */
require('dotenv').config();
const { connectDb } = require('../db');
const User = require('../models/User');

async function main() {
  const [, , email, role] = process.argv;
  if (!email || !User.ROLES.includes(role)) {
    console.error(`Usage: node src/scripts/setRole.js <email> <${User.ROLES.join('|')}>`);
    process.exit(1);
  }

  await connectDb();
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { role },
    { new: true }
  );

  if (!user) {
    console.error(`No user found with email ${email}. They must sign in at least once first.`);
    process.exit(1);
  }

  console.log(`${user.email} is now: ${user.role}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
