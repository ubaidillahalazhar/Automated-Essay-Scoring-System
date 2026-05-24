const prisma = require('../config/prismaClient');
const { hashPassword, comparePassword } = require('../utils/bcryptUtils');
const { sendOtpEmail } = require('../utils/emailUtils');
const jwt = require('jsonwebtoken');

/**
 * 1. REGISTRASI (Tahap Parkir ke PendingUser)
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const role_id = role === "teacher" ? 2 : 3;

    const existingUser = await prisma.userDetail.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Email sudah terdaftar dan aktif. Silakan login." });
    }

    const hashedPassword = await hashPassword(password);
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); 

    await prisma.pendingUser.upsert({
      where: { email: email },
      update: {
        name,
        password_hash: hashedPassword,
        role_id,
        otp_code: otpCode,
        otp_expires_at: otpExpiresAt
      },
      create: {
        email,
        name,
        password_hash: hashedPassword,
        role_id,
        otp_code: otpCode,
        otp_expires_at: otpExpiresAt
      }
    });

    await sendOtpEmail(email, otpCode);

    res.status(201).json({ message: "OTP berhasil dikirim ke email! Silakan cek inbox Anda." });
  } catch (error) {
    console.error("Error di Register:", error);
    res.status(500).json({ message: "Terjadi kesalahan saat registrasi." });
  }
};

/**
 * 2. VERIFIKASI OTP (Tahap Peresmian Akun & Injeksi Data)
 */
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const pendingData = await prisma.pendingUser.findUnique({ where: { email } });

    if (!pendingData) return res.status(404).json({ message: "Data pendaftaran tidak ditemukan." });
    if (pendingData.otp_code !== otp) return res.status(401).json({ message: "Kode OTP salah." });
    if (new Date() > pendingData.otp_expires_at) return res.status(401).json({ message: "OTP kedaluwarsa." });

    const [newUser] = await prisma.$transaction([
      prisma.user.create({
        data: {
          name: pendingData.name,
          role_id: pendingData.role_id,
          userDetail: {
            create: {
              email: pendingData.email,
              password_hash: pendingData.password_hash
            }
          }
        }
      }),
      prisma.pendingUser.delete({ where: { email } })
    ]);

    // Ambil ID dari akun yang baru saja dibuat
    const userId = newUser.user_id || newUser.id; 

    // Jika yang mendaftar adalah Guru (role_id === 2)
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

    res.status(200).json({ message: "Akun berhasil diverifikasi dan diaktifkan!"});
    
  } catch (error) {
    console.error("Error di verifyOtp:", error);
    res.status(500).json({ message: "Gagal memverifikasi akun." });
  }
};

/**
 * 3. LOGIN (Tahap Masuk Normal)
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const userDetail = await prisma.userDetail.findUnique({
      where: { email: email },
      include: { user: true }
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

    if (roleId === 1) {
      roleString = "admin";
    } else if (roleId === 2) {
      roleString = "teacher";
    } else if (roleId === 3) {
      roleString = "student";
    } else {
      return res.status(403).json({ 
        message: "Akses ditolak: Peran pengguna tidak dikenali atau tidak valid." 
      });
    }

    const token = jwt.sign(
      { userId: userDetail.user_id, roleId: roleId },
      process.env.JWT_SECRET || 'RAHASIA_NEGARA',
      { expiresIn: '1d' }
    );

    res.status(200).json({
      message: "Login sukses!",
      token: token,
      user: { id: userDetail.user_id, name: userDetail.user.name, email: userDetail.email, role: roleString}
    });

  } catch (error) {
    console.error("Error di Login:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

module.exports = {
  login,
  register,
  verifyOtp
};