// src/controllers/authController.js
const prisma = require('../config/prismaClient');
const { hashPassword, comparePassword } = require('../utils/bcryptUtils');
const { sendOtpEmail } = require('../utils/emailUtils');
const jwt = require('jsonwebtoken');

// Fungsi untuk tahap 1 Login (Cek kredensial)
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Cari user berdasarkan email
    const userDetail = await prisma.userDetail.findUnique({
      where: { email: email }
    });

    if (!userDetail) {
      return res.status(404).json({ message: "Email tidak ditemukan." });
    }

    // 2. Cek apakah password cocok
    const isMatch = await comparePassword(password, userDetail.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Password salah." });
    }

    // 3. BUAT OTP SUNGGUHAN (6 angka acak)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 4. Tentukan batas waktu OTP (5 menit)
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // 5. Simpan OTP tersebut ke database UserDetail
    await prisma.userDetail.update({
      where: { email: email },
      data: {
        otp_code: otpCode,
        otp_expires_at: otpExpiresAt
      }
    });

    // 6. KIRIM EMAIL SUNGGUHAN 
    // (Ini menggantikan console.log terminal yang kemarin)
    await sendOtpEmail(email, otpCode);

    // 7. Berikan respons sukses ke Postman
    res.status(200).json({
      message: "Kredensial benar, silakan cek email Anda untuk melihat OTP.",
      userId: userDetail.user_id,
      email: userDetail.email
    });

  } catch (error) {
    console.error("Error saat login:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};


const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const role_id = role === "teacher" ? 1 : 2;

    // Cek apakah email sudah ada di tabel USER utama (Akun yang sudah jadi)
    const existingUser = await prisma.userDetail.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Email sudah terdaftar dan terverifikasi." });
    }

    const hashedPassword = await hashPassword(password);
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // SIMPAN KE TABEL SEMENTARA (PendingUser)
    // Menggunakan 'upsert' agar jika email sudah ada di pending, datanya diperbarui (solusi email tersangkut)
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

    res.status(201).json({ message: "OTP dikirim! Silakan verifikasi email Anda." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Terjadi kesalahan saat registrasi." });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // 1. Cari di tabel SEMENTARA
    const pendingData = await prisma.pendingUser.findUnique({ where: { email } });

    if (!pendingData) return res.status(404).json({ message: "Data pendaftaran tidak ditemukan." });
    if (pendingData.otp_code !== otp) return res.status(401).json({ message: "Kode OTP salah." });
    if (new Date() > pendingData.otp_expires_at) return res.status(401).json({ message: "OTP kedaluwarsa." });

    // 2. PINDAHKAN KE TABEL UTAMA (Gunakan Transaction agar aman)
    const result = await prisma.$transaction([
      // Simpan ke tabel User utama
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
      // Hapus dari tabel sementara
      prisma.pendingUser.delete({ where: { email } })
    ]);

    res.status(200).json({ message: "Akun berhasil diverifikasi dan dibuat! Silakan login." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal memverifikasi akun." });
  }
};

// Jangan lupa daftarkan fungsinya di module.exports paling bawah
module.exports = {
  login,
  register,
  verifyOtp
};