const logger = require('../utils/loggerUtils');

/**
 * @param {{windowMs: number, max: number, keyFn?: Function, message?: string, label?: string}} options
 * @returns {import('express').RequestHandler}
 */
const createRateLimiter = ({ windowMs, max, keyFn, message, label = 'request' }) => {
  /** @type {Map<string, {count: number, resetAt: number}>} */
  const hits = new Map();

  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  if (typeof sweeper.unref === 'function') sweeper.unref();

  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : req.ip;
    if (!key) return next();

    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      logger.warn(`Rate limit terlampaui (${label}): key=${key}, count=${entry.count}`);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        status: 'error',
        message: message || `Terlalu banyak permintaan. Coba lagi dalam ${retryAfter} detik.`
      });
    }

    next();
  };
};

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const forgotPasswordByEmail = createRateLimiter({
  windowMs: FIFTEEN_MINUTES,
  max: 3,
  label: 'forgot-password/email',
  keyFn: (req) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    return email ? `email:${email}` : null;
  },
  message: 'Terlalu banyak permintaan reset password untuk email ini. Coba lagi dalam 15 menit.'
});

const forgotPasswordByIp = createRateLimiter({
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  label: 'forgot-password/ip',
  keyFn: (req) => `ip:${req.ip}`,
  message: 'Terlalu banyak permintaan dari jaringan ini. Coba lagi nanti.'
});

const verifyResetOtpByIp = createRateLimiter({
  windowMs: FIFTEEN_MINUTES,
  max: 20,
  label: 'verify-reset-otp/ip',
  keyFn: (req) => `ip:${req.ip}`,
  message: 'Terlalu banyak percobaan verifikasi. Coba lagi nanti.'
});

module.exports = {
  createRateLimiter,
  forgotPasswordByEmail,
  forgotPasswordByIp,
  verifyResetOtpByIp
};