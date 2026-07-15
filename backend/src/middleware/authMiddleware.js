// File: backend/src/middleware/authMiddleware.js
//
// AUTENTIKASI: memverifikasi JWT dan mengisi req.user.
// Pengecekan role (otorisasi) ada di roleMiddleware.js.

const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Akses ditolak! Token tidak ditemukan.' });
  }

  const secretKey = process.env.JWT_SECRET;
  if (!secretKey) {
    console.error('FATAL: JWT_SECRET tidak di-set.');
    return res.status(500).json({ message: 'Konfigurasi server bermasalah.' });
  }

  try {
    const decoded = jwt.verify(token, secretKey, { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Token tidak valid atau sudah kadaluarsa.' });
  }
};

module.exports = { authenticateToken };
