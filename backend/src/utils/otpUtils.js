
const crypto = require('crypto');

const OTP_TTL_MINUTES = parseInt(process.env.OTP_TTL_MINUTES || '5', 10);

/**
 * @param {number} length
 * @returns {string}
 */
function generateOtp(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return crypto.randomInt(min, max).toString();
}

/**
 * @param {number} minutes
 * @returns {Date}
 */
function getOtpExpiry(minutes = OTP_TTL_MINUTES) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * @param {Date|string|number} expiresAt
 * @returns {boolean}
 */
function isOtpExpired(expiresAt) {
  return new Date() > new Date(expiresAt);
}

module.exports = { generateOtp, getOtpExpiry, isOtpExpired, OTP_TTL_MINUTES };
