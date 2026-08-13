const prisma = require('../config/prismaClient');
const { hashPassword, comparePassword } = require('../utils/bcryptUtils');
const { generateOtp, getOtpExpiry, isOtpExpired } = require('../utils/otpUtils');
const { sendOtpEmail } = require('../utils/emailUtils');
const { AppError } = require('../middleware/errorHandler');
const jwt = require('jsonwebtoken');
const { invalidateUserCache } = require('../middleware/authMiddleware');
const { issueCaptcha, issuePassToken, verifyCaptcha, isCaptchaEnabled, resolveImagePath } = require('../utils/captchaUtils');
const normalizeEmail = (email) => (email || '').trim().toLowerCase();

const ensureSelf = (req) => {
  const paramId = parseInt(req.params.user_id);
  if (!paramId || req.user.userId !== paramId) {
    return { ok: false, status: 403, message: "Anda hanya boleh mengakses data sendiri." };
  }
  return { ok: true, userId: paramId };
};

const register = async (req, res) => {
  const { name, email, password, role, grade_id } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const role_id = role === "teacher" ? 2 : 3;

  const existingUser = await prisma.userDetail.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    throw new AppError("Email sudah terdaftar dan aktif. Silakan login.", 400);
  }

  const hashedPassword = await hashPassword(password);
  const otpCode = generateOtp();
  const otpExpiresAt = getOtpExpiry();

  const pendingData = {
    email: normalizedEmail,
    name,
    password_hash: hashedPassword,
    role_id,
    otp_code: otpCode,
    otp_expires_at: otpExpiresAt
  };

  if (role === "student" && grade_id) {
    pendingData.grade_id = parseInt(grade_id);
  }

  await prisma.pendingUser.upsert({
    where: { email: normalizedEmail },
    update: {
      name: pendingData.name,
      password_hash: pendingData.password_hash,
      role_id: pendingData.role_id,
      otp_code: pendingData.otp_code,
      otp_expires_at: pendingData.otp_expires_at,
      grade_id: pendingData.grade_id || null
    },
    create: pendingData
  });

  await sendOtpEmail(normalizedEmail, otpCode);

  res.status(201).json({
    message: "OTP berhasil dikirim ke email! Silakan cek inbox Anda."
  });
};

const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  const normalizedEmail = normalizeEmail(email);

  const pendingData = await prisma.pendingUser.findUnique({ where: { email: normalizedEmail } });

  if (!pendingData) throw new AppError("Data pendaftaran tidak ditemukan.", 404);
  if (pendingData.otp_code !== otp) throw new AppError("Kode OTP salah.", 401);
  if (isOtpExpired(pendingData.otp_expires_at)) throw new AppError("OTP kedaluwarsa.", 401);

  const userDetailCreate = {
    email: pendingData.email,
    password_hash: pendingData.password_hash
  };

  if (pendingData.role_id === 3 && pendingData.grade_id) {
    userDetailCreate.grade_id = pendingData.grade_id;
  }
  if (pendingData.role_id === 2) {
    userDetailCreate.teaching_level = "SD";
  }

  const [newUser] = await prisma.$transaction([
    prisma.user.create({
      data: {
        name: pendingData.name,
        role_id: pendingData.role_id,
        userDetail: { create: userDetailCreate }
      }
    }),
    prisma.pendingUser.delete({ where: { email: normalizedEmail } })
  ]);

  const userId = newUser.user_id;

  if (newUser.role_id === 2) {
    await prisma.subject.createMany({
      data: [
        { subject_name: "Matematika", teacher_id: userId },
        { subject_name: "Bahasa Indonesia", teacher_id: userId },
        { subject_name: "IPA", teacher_id: userId },
        { subject_name: "Olahraga", teacher_id: userId },
      ]
    });
  }

  res.status(200).json({ message: "Akun berhasil diverifikasi dan diaktifkan!" });
};

// ==========================================
// CAPTCHA: kirim soal + token ke halaman login
// GET /api/auth/captcha
// ==========================================
const getCaptcha = async (req, res) => {
  if (!isCaptchaEnabled()) {
    return res.status(200).json({ status: "success", enabled: false });
  }
  const captcha = issueCaptcha();
  res.set('Cache-Control', 'no-store');
  res.status(200).json({ status: "success", enabled: true, ...captcha });
};

// ==========================================
// CAPTCHA: sajikan satu gambar berdasarkan id bersegel
// GET /api/auth/captcha/image/:id
// ==========================================
const getCaptchaImage = async (req, res) => {
  const filePath = resolveImagePath(req.params.id);
  if (!filePath) throw new AppError('Gambar tidak ditemukan.', 404);

  res.set('Cache-Control', 'private, max-age=300');
  res.sendFile(filePath);
};

// ==========================================
// CAPTCHA: periksa jawaban soal, terbitkan tiket lulus
// POST /api/auth/captcha/verify   Body: { token, answer }
// ==========================================
const verifyCaptchaChallenge = async (req, res) => {
  const { token, answer } = req.body;

  const result = await verifyCaptcha(token, answer, req.ip);
  if (!result.ok) {
    const err = new AppError(result.message, 400);
    err.code = 'CAPTCHA_INVALID';
    throw err;
  }

  res.status(200).json({ status: "success", pass_token: issuePassToken() });
};

const login = async (req, res) => {
  const { email, password, captcha_token, captcha_answer } = req.body;

  // Verifikasi CAPTCHA sebelum menyentuh database sama sekali.
  if (isCaptchaEnabled()) {
    const captcha = await verifyCaptcha(captcha_token, captcha_answer, req.ip);
    if (!captcha.ok) {
      const err = new AppError(captcha.message, 400);
      err.code = 'CAPTCHA_INVALID';   // dipakai frontend untuk auto-refresh soal
      throw err;
    }
  }

  const userDetail = await prisma.userDetail.findUnique({
    where: { email: email },
    include: { user: true, grade: true }
  });

  if (!userDetail) {
    throw new AppError("Email belum terdaftar atau belum diverifikasi.", 404);
  }

  const isMatch = await comparePassword(password, userDetail.password_hash);
  if (!isMatch) throw new AppError("Password salah.", 401);

  const roleId = userDetail.user.role_id;
  let roleString = "";
  if (roleId === 1) roleString = "admin";
  else if (roleId === 2) roleString = "teacher";
  else if (roleId === 3) roleString = "student";
  else throw new AppError("Akses ditolak: Peran tidak dikenali.", 403);

  const token = jwt.sign(
    { userId: userDetail.user_id, roleId: roleId },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  // Dipakai laporan "Aktivitas Siswa" untuk menandai siswa yang belum pernah masuk.
  await prisma.userDetail.update({
    where: { user_id: userDetail.user_id },
    data: { last_login: new Date() }
  }).catch(() => { /* jangan gagalkan login hanya karena pencatatan */ });

  res.status(200).json({
    message: "Login sukses!",
    token: token,
    user: {
      id: userDetail.user_id,
      name: userDetail.user.name,
      email: userDetail.email,
      role: roleString,
      grade_id: userDetail.grade_id || null,
      grade_name: userDetail.grade?.grade_name || null,
      school_level: userDetail.grade?.school_level || null,
      teaching_level: userDetail.teaching_level || null
    }
  });
};

const getProfile = async (req, res) => {
  const check = ensureSelf(req);
  if (!check.ok) throw new AppError(check.message, check.status);
  const userId = check.userId;

  const userDetail = await prisma.userDetail.findUnique({
    where: { user_id: userId },
    include: { user: true, grade: true }
  });

  if (!userDetail) throw new AppError("User tidak ditemukan.", 404);

  const roleId = userDetail.user.role_id;
  const roleString = roleId === 1 ? "admin" : roleId === 2 ? "teacher" : "student";

  res.status(200).json({
    status: "success",
    user: {
      id: userDetail.user_id,
      name: userDetail.user.name,
      email: userDetail.email,
      role: roleString,
      grade_id: userDetail.grade_id || null,
      grade_name: userDetail.grade?.grade_name || null,
      school_level: userDetail.grade?.school_level || null,
      teaching_level: userDetail.teaching_level || null,
      created_at: userDetail.user.created_at || null
    }
  });
};

const updateProfile = async (req, res) => {
  const check = ensureSelf(req);
  if (!check.ok) throw new AppError(check.message, check.status);
  const userId = check.userId;
  const { name, grade_id, teaching_level } = req.body;

  if (!name && !grade_id && !teaching_level) {
    throw new AppError("Tidak ada perubahan yang dikirim.", 400);
  }

  if (grade_id) {
    const grade = await prisma.grade.findUnique({ where: { grade_id: parseInt(grade_id) } });
    if (!grade) throw new AppError("Grade tidak ditemukan.", 404);
  }

  const ALLOWED_LEVELS = ["SD", "SMP", "SMA"];
  if (teaching_level && !ALLOWED_LEVELS.includes(teaching_level)) {
    throw new AppError("Jenjang mengajar tidak valid.", 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (name) {
      await tx.user.update({
        where: { user_id: userId },
        data: { name: name.trim() }
      });
    }

    const detailData = {};
    if (grade_id) detailData.grade_id = parseInt(grade_id);
    if (teaching_level) detailData.teaching_level = teaching_level;

    if (Object.keys(detailData).length > 0) {
      await tx.userDetail.update({
        where: { user_id: userId },
        data: detailData
      });
    }

    return await tx.userDetail.findUnique({
      where: { user_id: userId },
      include: { grade: true, user: true }
    });
  });

  if (!updated) throw new AppError("User tidak ditemukan.", 404);

  const roleId = updated.user.role_id;
  const roleString = roleId === 1 ? "admin" : roleId === 2 ? "teacher" : "student";

  res.status(200).json({
    status: "success",
    message: "Profil berhasil diperbarui!",
    user: {
      id: updated.user_id,
      name: updated.user.name,
      email: updated.email,
      role: roleString,
      grade_id: updated.grade_id || null,
      grade_name: updated.grade?.grade_name || null,
      school_level: updated.grade?.school_level || null,
      teaching_level: updated.teaching_level || null
    }
  });
};

const changePassword = async (req, res) => {
  const check = ensureSelf(req);
  if (!check.ok) throw new AppError(check.message, check.status);
  const userId = check.userId;
  const { old_password, new_password } = req.body;
  if (!old_password) throw new AppError("Password lama wajib diisi.", 400);
  if (!new_password) throw new AppError("Password baru wajib diisi.", 400);
  if (new_password.length < 6) {
    throw new AppError("Password baru minimal 6 karakter.", 400);
  }

  const userDetail = await prisma.userDetail.findUnique({
    where: { user_id: userId }
  });

  if (!userDetail) throw new AppError("User tidak ditemukan.", 404);

  const isMatch = await comparePassword(old_password, userDetail.password_hash);
  if (!isMatch) throw new AppError("Password lama salah.", 401);

  const isSame = await comparePassword(new_password, userDetail.password_hash);
  if (isSame) throw new AppError("Password baru tidak boleh sama dengan yang lama.", 400);

  const newHashed = await hashPassword(new_password);
  await prisma.userDetail.update({
    where: { user_id: userId },
    data: {
      password_hash: newHashed,
      password_changed_at: new Date(),
      updated_at: new Date()
    }
  });

  invalidateUserCache(userId);

  const freshToken = jwt.sign(
    { userId: userId, roleId: req.user.roleId },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  res.status(200).json({
    status: "success",
    message: "Password berhasil diubah!",
    token: freshToken
  });
};

module.exports = {
  getCaptcha,
  getCaptchaImage,
  verifyCaptchaChallenge,
  login,
  register,
  verifyOtp,
  getProfile,
  updateProfile,
  changePassword
};