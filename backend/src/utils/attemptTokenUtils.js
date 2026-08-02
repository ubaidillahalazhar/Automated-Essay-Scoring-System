
const crypto = require('crypto');
const TOKEN_SECRET = process.env.ATTEMPT_TOKEN_SECRET || process.env.JWT_SECRET;

/**
 * @param {string} payload
 * @returns {string}
 */
function signPayload(payload) {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
}

/**
 * @returns {string} "<payload>.<signature>"
 */
function encodeAttemptToken(userId, quizId, timestamp) {
  const payload = Buffer.from(`${userId}:${quizId}:${timestamp}`, 'utf8').toString('base64url');
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

/**
 * @param {string} token
 * @returns {{userId: number, quizId: number, timestamp: number}|null}
 */
function decodeAttemptToken(token) {
  try {
    if (typeof token !== 'string' || !token.includes('.')) return null;

    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;

    const expected = signPayload(payload);
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const raw = Buffer.from(payload, 'base64url').toString('utf8');
    const [userId, quizId, timestamp] = raw.split(':');
    return {
      userId: parseInt(userId),
      quizId: parseInt(quizId),
      timestamp: parseInt(timestamp),
    };
  } catch (e) {
    return null;
  }
}

module.exports = { encodeAttemptToken, decodeAttemptToken };
