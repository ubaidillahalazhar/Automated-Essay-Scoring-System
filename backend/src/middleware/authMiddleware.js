const jwt = require('jsonwebtoken');
const prisma = require('../config/prismaClient');
const logger = require('../utils/loggerUtils');

const CACHE_TTL_MS = 60 * 1000;

/** @type {Map<number, {found: boolean, isActive: boolean, changedAt: number|null, expiresAt: number}>} */
const userStateCache = new Map();

/**
 * @param {number} userId
 */
const invalidateUserCache = (userId) => {
  userStateCache.delete(Number(userId));
};

/**
 * @param {number} userId
 * @returns {Promise<{found: boolean, isActive: boolean, changedAt: number|null}>}
 */
const getUserState = async (userId) => {
  const now = Date.now();
  const cached = userStateCache.get(userId);
  if (cached && cached.expiresAt > now) return cached;

  const detail = await prisma.userDetail.findUnique({
    where: { user_id: userId },
    select: { is_active: true, password_changed_at: true }
  });

  const state = {
    found: Boolean(detail),
    isActive: detail ? detail.is_active : false,
    changedAt: detail?.password_changed_at ? detail.password_changed_at.getTime() : null,
    expiresAt: now + CACHE_TTL_MS
  };

  userStateCache.set(userId, state);
  return state;
};

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Akses ditolak! Token tidak ditemukan.' });
  }

  const secretKey = process.env.JWT_SECRET;
  if (!secretKey) {
    logger.error('FATAL: JWT_SECRET tidak di-set.');
    return res.status(500).json({ message: 'Konfigurasi server bermasalah.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, secretKey, { algorithms: ['HS256'] });
  } catch (error) {
    return res.status(403).json({ message: 'Token tidak valid atau sudah kadaluarsa.' });
  }

  if (!decoded || !decoded.userId) {
    return res.status(403).json({ message: 'Token tidak valid.' });
  }

  try {
    const state = await getUserState(decoded.userId);

    if (!state.found || !state.isActive) {
      return res.status(403).json({ message: 'Akun tidak aktif atau tidak ditemukan.' });
    }

    if (state.changedAt && decoded.iat * 1000 < state.changedAt - 1000) {
      return res.status(401).json({
        message: 'Sesi tidak berlaku karena password telah diubah. Silakan login kembali.'
      });
    }
  } catch (error) {
    logger.error('Gagal memeriksa status user di authMiddleware:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }

  req.user = decoded;
  next();
};

module.exports = { authenticateToken, invalidateUserCache };