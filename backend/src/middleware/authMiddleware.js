const jwt = require('jsonwebtoken');

// role_id sesuai DB: 1=admin, 2=teacher, 3=student
const ROLE = { ADMIN: 1, TEACHER: 2, STUDENT: 3 };

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: "Akses ditolak! Token tidak ditemukan." });
  }

  const secretKey = process.env.JWT_SECRET;
  if (!secretKey) {
    console.error("FATAL: JWT_SECRET tidak di-set.");
    return res.status(500).json({ message: "Konfigurasi server bermasalah." });
  }

  try {
    const decoded = jwt.verify(token, secretKey, { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Token tidak valid atau sudah kadaluarsa." });
  }
};

const isTeacher = (req, res, next) => {
  if (req.user && req.user.roleId === ROLE.TEACHER) return next();
  return res.status(403).json({ message: "Akses ditolak! Hanya Guru yang boleh." });
};

const isStudent = (req, res, next) => {
  if (req.user && req.user.roleId === ROLE.STUDENT) return next();
  return res.status(403).json({ message: "Akses ditolak! Hanya Murid yang boleh." });
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.roleId === ROLE.ADMIN) return next();
  return res.status(403).json({ message: "Akses ditolak! Hanya Admin yang boleh." });
};

module.exports = { authenticateToken, isTeacher, isStudent, isAdmin, ROLE };