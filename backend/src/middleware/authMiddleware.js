const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  // 1. Ambil header 'Authorization' dari request
  const authHeader = req.headers['authorization'];
  
  // 2. Format token biasanya "Bearer eyJhbGciOi...", kita split untuk ambil tokennya saja
  const token = authHeader && authHeader.split(' ')[1];

  // 3. Jika tidak ada token bawaan, usir (Status 401: Unauthorized)
  if (!token) {
    return res.status(401).json({ message: "Akses ditolak! Tiket token tidak ditemukan." });
  }

  // 4. Verifikasi keaslian token
  try {
    const secretKey = process.env.JWT_SECRET || 'RAHASIA_NEGARA'; // Pastikan sama dengan di authController
    const decoded = jwt.verify(token, secretKey);
    
    // 5. Simpan data user (userId dan roleId) dari dalam token ke req.user
    req.user = decoded;
    
    // 6. Persilakan masuk ke controller selanjutnya
    next();
  } catch (error) {
    // Jika token kadaluarsa atau palsu (Status 403: Forbidden)
    return res.status(403).json({ message: "Tiket token tidak valid atau sudah kadaluarsa." });
  }
};

// Opsional: Satpam khusus untuk mengecek apakah dia Guru (role_id: 1)
const isTeacher = (req, res, next) => {
  if (req.user && req.user.roleId === 1) {
    next();
  } else {
    return res.status(403).json({ message: "Akses ditolak! Hanya Guru yang boleh melakukan aksi ini." });
  }
};

module.exports = { authenticateToken, isTeacher };