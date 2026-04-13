// src/utils/generateVerificationToken.ts
import crypto from 'crypto';

export const generateVerificationToken = () => {
  // Generate a random 32-byte string
  const token = crypto.randomBytes(32).toString('hex');

  // Hash the token to store in the DB (standard security practice)
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Set expiration (e.g., 24 hours from now)
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  return { token, hashedToken, expires };
};