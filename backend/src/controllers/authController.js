// src/controllers/authController.js
const prisma = require('../config/prismaClient');
const { hashPassword, comparePassword } = require('../utils/bcryptUtils');
const { sendOtpEmail } = require('../utils/emailUtils');
const jwt = require('jsonwebtoken');

/**
 * 1. REGISTRASI (Tahap Parkir ke PendingUser)
 * Tugas: Simpan data sementara, buat OTP, dan kirim ke Gmail.
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    // Map role: guru = 1, siswa = 2
    const role_id = role === "teacher" ? 1 : 2;

    // Pastikan email belum punya akun resmi di UserDetail
    const existingUser = await prisma.userDetail.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Email sudah terdaftar dan aktif. Silakan login." });
    }

    const hashedPassword = await hashPassword(password);
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // Berlaku 5 menit

    // Parkir data di tabel PendingUser
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

    // Kirim OTP sungguhan ke Gmail
    await sendOtpEmail(email, otpCode);

    res.status(201).json({ message: "OTP berhasil dikirim ke email! Silakan cek inbox Anda." });
  } catch (error) {
    console.error("Error di Register:", error);
    res.status(500).json({ message: "Terjadi kesalahan saat registrasi." });
  }
};

/**
 * 2. VERIFIKASI OTP (Tahap Peresmian Akun)
 * Tugas: Cek OTP, pindahkan ke tabel utama, dan langsung beri Tiket (JWT).
 */
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // 1. Cari data di "Ruang Tunggu" (PendingUser)
    const pendingData = await prisma.pendingUser.findUnique({ where: { email } });

    if (!pendingData) return res.status(404).json({ message: "Data pendaftaran tidak ditemukan." });
    if (pendingData.otp_code !== otp) return res.status(401).json({ message: "Kode OTP salah." });
    if (new Date() > pendingData.otp_expires_at) return res.status(401).json({ message: "OTP kedaluwarsa." });

    // 2. Transaksi: Pindahkan data ke tabel resmi dan hapus dari pending
    const [newUser] = await prisma.$transaction([
      // Buat akun di tabel User & UserDetail sekaligus
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
      // Hapus dari ruang tunggu
      prisma.pendingUser.delete({ where: { email } })
    ]);

    res.status(200).json({ message: "Akun berhasil diverifikasi dan diaktifkan!"});
  } catch (error) {
    res.status(500).json({ message: "Gagal memverifikasi akun." });
  }
};

/**
 * 3. LOGIN (Tahap Masuk Normal)
 * Tugas: Untuk user yang sudah aktif, cek password, dan beri Tiket (JWT).
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Cari di tabel resmi (UserDetail)
    const userDetail = await prisma.userDetail.findUnique({
      where: { email: email },
      include: { user: true }
    });

    if (!userDetail) {
      return res.status(404).json({ message: "Email belum terdaftar atau belum diverifikasi." });
    }

    // Cek kecocokan password
    const isMatch = await comparePassword(password, userDetail.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Password salah." });
    }

    const roleId = userDetail.user.role_id;
    let roleString = "";

    // 2. Validasi ketat menggunakan Percabangan Eksplisit
    if (roleId === 1) {
      roleString = "teacher";
    } else if (roleId === 2) {
      roleString = "student";
    } else {
      // 🚨 Memunculkan error jika role_id tidak valid atau di luar angka 1 & 2
      return res.status(403).json({ 
        message: "Akses ditolak: Peran pengguna tidak dikenali atau tidak valid." 
      });
    }

    // 3. Berikan Tiket Masuk (JWT) jika lolos validasi
    const token = jwt.sign(
      { userId: userDetail.user_id, roleId: roleId },
      process.env.JWT_SECRET || 'RAHASIA_NEGARA',
      { expiresIn: '1d' }
    );

    // 4. Kirim respons sukses dengan data peran yang sudah pasti aman

    res.status(200).json({
      message: "Login sukses!",
      token: token,
      user: { id: userDetail.user_id, name: userDetail.user.name, email: userDetail.email, role: roleString }
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