const prisma = require('../config/prismaClient');
const { hashPassword, comparePassword } = require('../utils/bcryptUtils');
const { sendOtpEmail } = require('../utils/emailUtils');
const jwt = require('jsonwebtoken');

/**
 * 1. REGISTRASI
 *
 * Body: { name, email, password, role, grade_id? }
 * grade_id sekarang langsung disimpan ke PendingUser (setelah migration).
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role, grade_id } = req.body;
    const role_id = role === "teacher" ? 2 : 3;

    const existingUser = await prisma.userDetail.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Email sudah terdaftar dan aktif. Silakan login." });
    }

    const hashedPassword = await hashPassword(password);
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Siapkan data — grade_id hanya untuk siswa
    const pendingData = {
      email,
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
  } catch (error) {
    console.error("Error di Register:", error);
    res.status(500).json({ message: "Terjadi kesalahan saat registrasi." });
  }
};

/**
 * 2. VERIFIKASI OTP
 *
 * Body: { email, otp }
 * grade_id otomatis dari PendingUser. Tidak perlu workaround localStorage lagi.
 */
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const pendingData = await prisma.pendingUser.findUnique({ where: { email } });

    if (!pendingData) return res.status(404).json({ message: "Data pendaftaran tidak ditemukan." });
    if (pendingData.otp_code !== otp) return res.status(401).json({ message: "Kode OTP salah." });
    if (new Date() > pendingData.otp_expires_at) return res.status(401).json({ message: "OTP kedaluwarsa." });

    // Siapkan data UserDetail
    const userDetailCreate = {
      email: pendingData.email,
      password_hash: pendingData.password_hash
    };

    // Siswa: ambil grade_id dari PendingUser
    if (pendingData.role_id === 3 && pendingData.grade_id) {
      userDetailCreate.grade_id = pendingData.grade_id;
    }

    // Guru: set teaching_level
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

    // Untuk guru, otomatis buat 4 subject default
    if (newUser.role_id === 2) {
      await prisma.subject.createMany({
        data: [
          { subject_name: "Matematika", teacher_id: userId },
          { subject_name: "Bahasa Indonesia", teacher_id: userId },
          { subject_name: "IPA", teacher_id: userId },
          { subject_name: "Olahraga", teacher_id: userId },
        ]
      });
      await prisma.userDetail.update({
        where: { user_id: userId },
        data: { teaching_level: "SD" }
      });
    }

    res.status(200).json({ message: "Akun berhasil diverifikasi dan diaktifkan!" });

  } catch (error) {
    console.error("Error di verifyOtp:", error);
    res.status(500).json({ message: "Gagal memverifikasi akun." });
  }
};

/**
 * 3. LOGIN
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const userDetail = await prisma.userDetail.findUnique({
      where: { email: email },
      include: {
        user: true,
        grade: true
      }
    });

    if (!userDetail) {
      return res.status(404).json({ message: "Email belum terdaftar atau belum diverifikasi." });
    }

    const isMatch = await comparePassword(password, userDetail.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Password salah." });
    }

    const roleId = userDetail.user.role_id;
    let roleString = "";

    if (roleId === 1) roleString = "admin";
    else if (roleId === 2) roleString = "teacher";
    else if (roleId === 3) roleString = "student";
    else {
      return res.status(403).json({ message: "Akses ditolak: Peran pengguna tidak dikenali." });
    }

    const token = jwt.sign(
      { userId: userDetail.user_id, roleId: roleId },
      process.env.JWT_SECRET || 'RAHASIA_NEGARA',
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

  } catch (error) {
    console.error("Error di Login:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

/**
 * 4. UPDATE PROFILE (BARU)
 *
 * Endpoint: PUT /api/auth/profile/:user_id
 * Body: { grade_id }
 *
 * Untuk fix akun siswa lama yang grade_id-nya null.
 * Bisa juga dipakai untuk siswa pindah kelas di masa depan.
 */
const updateProfile = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { grade_id } = req.body;

    if (!user_id) return res.status(400).json({ message: "User ID wajib." });
    if (!grade_id) return res.status(400).json({ message: "Grade ID wajib." });

    const userId = parseInt(user_id);
    const gradeId = parseInt(grade_id);

    // Validasi: grade ada di DB
    const grade = await prisma.grade.findUnique({ where: { grade_id: gradeId } });
    if (!grade) return res.status(404).json({ message: "Grade tidak ditemukan." });

    // Update UserDetail
    const updated = await prisma.userDetail.update({
      where: { user_id: userId },
      data: { grade_id: gradeId },
      include: { grade: true, user: true }
    });

    res.status(200).json({
      status: "success",
      message: "Profil berhasil diperbarui!",
      user: {
        id: updated.user_id,
        name: updated.user.name,
        email: updated.email,
        role: updated.user.role_id === 3 ? "student" : updated.user.role_id === 2 ? "teacher" : "admin",
        grade_id: updated.grade_id,
        grade_name: updated.grade?.grade_name || null,
        school_level: updated.grade?.school_level || null,
        teaching_level: updated.teaching_level || null
      }
    });
  } catch (error) {
    console.error("❌ Error updateProfile:", error);
    res.status(500).json({ message: "Gagal memperbarui profil.", error: error.message });
  }
};

module.exports = {
  login,
  register,
  verifyOtp,
  updateProfile
};