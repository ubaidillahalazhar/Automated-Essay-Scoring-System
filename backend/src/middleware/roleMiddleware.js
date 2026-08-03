
// role_id sesuai DB: 1=admin, 2=teacher, 3=student
const ROLE = { ADMIN: 1, TEACHER: 2, STUDENT: 3 };

/**
 * Factory middleware: hanya izinkan role tertentu.
 * Mendukung banyak role sekaligus.
 *
 *   requireRole(ROLE.TEACHER)              -> hanya guru
 *   requireRole(ROLE.TEACHER, ROLE.ADMIN) -> guru ATAU admin
 *
 * @param  {...number} allowedRoles Daftar role_id yang diizinkan.
 * @returns {import('express').RequestHandler}
 */
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (req.user && allowedRoles.includes(req.user.roleId)) return next();
  return res
    .status(403)
    .json({ message: 'Akses ditolak! Anda tidak punya izin untuk aksi ini.' });
};

const isTeacher = requireRole(ROLE.TEACHER);
const isStudent = requireRole(ROLE.STUDENT);
const isAdmin = requireRole(ROLE.ADMIN);

module.exports = { ROLE, requireRole, isTeacher, isStudent, isAdmin };
