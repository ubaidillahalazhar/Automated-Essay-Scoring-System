const prisma = require('../config/prismaClient');
const { hashPassword, comparePassword } = require('../utils/bcryptUtils');
const { generateOtp, getOtpExpiry, isOtpExpired } = require('../utils/otpUtils');
const { sendOtpEmail } = require('../utils/emailUtils');
const { AppError } = require('../middleware/errorHandler');
const jwt = require('jsonwebtoken');

const ensureSelf = (req) => {
  const paramId = parseInt(req.params.user_id);
  if (!paramId || req.user.userId !== paramId) {
    return { ok: false, status: 403, message: "Anda hanya boleh mengakses data sendiri." };
  }
  return { ok: true, userId: paramId };
};

// ==========================================
// 1. REGISTRASI
// ==========================================
const register = async (req, res) => {
  const { name, email, password, role, grade_id } = req.body;
  const role_id = role === "teacher" ? 2 : 3;

  const existingUser = await prisma.userDetail.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError("Email sudah terdaftar dan aktif. Silakan login.", 400);
  }

  const hashedPassword = await hashPassword(password);
  const otpCode = generateOtp();
  const otpExpiresAt = getOtpExpiry();

  const pendingData = {
    email, name,
    password_hash: hashedPassword,
    role_id,
    otp_code: otpCode,
    otp_expires_at: otpExpiresAt
  };

  if (role === "student" && grade_id) {
    pendingData.grade_id = parseInt(grade_id);
  }

  await prisma.pendingUser.upsert({
    where: { email: email },
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

  await sendOtpEmail(email, otpCode);

  res.status(201).json({
    message: "OTP berhasil dikirim ke email! Silakan cek inbox Anda."
  });
};

// ==========================================
// 2. VERIFIKASI OTP
// ==========================================
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  const pendingData = await prisma.pendingUser.findUnique({ where: { email } });

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
    prisma.pendingUser.delete({ where: { email } })
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
// 3. LOGIN
// ==========================================
const login = async (req, res) => {
  const { email, password } = req.body;

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

// ==========================================
// 4. GET PROFILE (BARU)
// Endpoint: GET /api/auth/profile/:user_id
//
// Mengembalikan full info user untuk halaman profil.
// ==========================================
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

// ==========================================
// 5. UPDATE PROFILE (EXTEND)
// Endpoint: PUT /api/auth/profile/:user_id
//
// Body bisa berisi: { name?, grade_id? }
// Field opsional - hanya update yang dikirim.
// ==========================================
const updateProfile = async (req, res) => {
  const check = ensureSelf(req);
  if (!check.ok) throw new AppError(check.message, check.status);
  const userId = check.userId;
  const { name, grade_id } = req.body;

  // Validasi: minimal salah satu field harus ada
  if (!name && !grade_id) {
    throw new AppError("Tidak ada perubahan yang dikirim.", 400);
  }

  // Validasi grade kalau dikirim
  if (grade_id) {
    const grade = await prisma.grade.findUnique({ where: { grade_id: parseInt(grade_id) } });
    if (!grade) throw new AppError("Grade tidak ditemukan.", 404);
  }

  // Update User (name) dan UserDetail (grade_id) dalam transaksi
  const updated = await prisma.$transaction(async (tx) => {
    // Update nama di tabel User
    if (name) {
      await tx.user.update({
        where: { user_id: userId },
        data: { name: name.trim() }
      });
    }

    // Update grade_id di UserDetail
    if (grade_id) {
      await tx.userDetail.update({
        where: { user_id: userId },
        data: { grade_id: parseInt(grade_id) }
      });
    }

    // Ambil hasil terbaru
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

// ==========================================
// 6. CHANGE PASSWORD (BARU)
// Endpoint: PUT /api/auth/password/:user_id
//
// Body: { old_password, new_password }
// Verifikasi old_password dulu, lalu update.
// ==========================================
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

  // Verifikasi password lama
  const isMatch = await comparePassword(old_password, userDetail.password_hash);
  if (!isMatch) throw new AppError("Password lama salah.", 401);

  // Cek password baru tidak sama dengan yang lama
  const isSame = await comparePassword(new_password, userDetail.password_hash);
  if (isSame) throw new AppError("Password baru tidak boleh sama dengan yang lama.", 400);

  // Hash dan update
  const newHashed = await hashPassword(new_password);
  await prisma.userDetail.update({
    where: { user_id: userId },
    data: { password_hash: newHashed }
  });

  res.status(200).json({
    status: "success",
    message: "Password berhasil diubah!"
  });
};

module.exports = {
  login,
  register,
  verifyOtp,
  getProfile,
  updateProfile,
  changePassword
};
