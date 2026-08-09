const crypto = require('crypto');
const prisma = require('../config/prismaClient');
const { hashPassword, comparePassword } = require('../utils/bcryptUtils');
const { generateOtp, getOtpExpiry, isOtpExpired } = require('../utils/otpUtils');
const { sendResetPasswordEmail } = require('../utils/emailUtils');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/loggerUtils');

const MAX_OTP_ATTEMPTS = 5;
const RESET_TOKEN_TTL_MINUTES = parseInt(process.env.RESET_TOKEN_TTL_MINUTES || '10', 10);

// Pesan seragam supaya penyerang tidak bisa menebak email mana yang terdaftar.
const GENERIC_MESSAGE = "Jika email terdaftar, kode OTP reset password sudah kami kirim.";

const cleanEmail = (email) => String(email || '').trim();
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const getTokenExpiry = () => new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

/** Perbandingan string yang aman dari timing attack. */
const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

// 1. MINTA KODE OTP RESET PASSWORD
const forgotPassword = async (req, res) => {
  const email = cleanEmail(req.body.email);
  if (!email) throw new AppError("Email wajib diisi.", 400);

  // Bersihkan permintaan lama yang sudah kedaluwarsa (housekeeping ringan).
  await prisma.passwordReset.deleteMany({
    where: { otp_expires_at: { lt: new Date(Date.now() - 60 * 60 * 1000) } }
  });

  const userDetail = await prisma.userDetail.findUnique({ where: { email } });

  if (!userDetail || !userDetail.is_active) {
    logger.warn(`Permintaan reset password untuk email tidak aktif/tidak terdaftar: ${email}`);
    return res.status(200).json({ status: "success", message: GENERIC_MESSAGE });
  }

  const otpCode = generateOtp();
  const otpExpiresAt = getOtpExpiry();

  await prisma.passwordReset.upsert({
    where: { email },
    update: {
      otp_code: otpCode,
      otp_expires_at: otpExpiresAt,
      attempts: 0,
      reset_token: null,
      token_expires_at: null
    },
    create: { email, otp_code: otpCode, otp_expires_at: otpExpiresAt }
  });

  await sendResetPasswordEmail(email, otpCode);

  res.status(200).json({ status: "success", message: GENERIC_MESSAGE });
};

// 2. VERIFIKASI OTP → TUKAR DENGAN RESET TOKEN
const verifyResetOtp = async (req, res) => {
  const email = cleanEmail(req.body.email);
  const otp = String(req.body.otp || '').trim();

  if (!email || !otp) throw new AppError("Email dan kode OTP wajib diisi.", 400);

  const record = await prisma.passwordReset.findUnique({ where: { email } });
  if (!record) throw new AppError("Permintaan reset tidak ditemukan. Silakan minta kode baru.", 404);

  if (isOtpExpired(record.otp_expires_at)) {
    await prisma.passwordReset.delete({ where: { email } });
    throw new AppError("Kode OTP kedaluwarsa. Silakan minta kode baru.", 401);
  }

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.passwordReset.delete({ where: { email } });
    throw new AppError("Terlalu banyak percobaan salah. Silakan minta kode baru.", 429);
  }

  if (!safeEqual(record.otp_code, otp)) {
    await prisma.passwordReset.update({
      where: { email },
      data: { attempts: { increment: 1 } }
    });
    const sisa = MAX_OTP_ATTEMPTS - (record.attempts + 1);
    throw new AppError(`Kode OTP salah. Sisa percobaan: ${sisa}.`, 401);
  }

  // OTP benar → terbitkan token sekali pakai. Yang disimpan hanya hash-nya.
  const resetToken = crypto.randomBytes(32).toString('hex');

  await prisma.passwordReset.update({
    where: { email },
    data: {
      otp_code: '',                       // OTP hangus setelah dipakai
      attempts: 0,
      reset_token: hashToken(resetToken),
      token_expires_at: getTokenExpiry()
    }
  });

  logger.info(`OTP reset password terverifikasi untuk ${email}`);

  res.status(200).json({
    status: "success",
    message: "Kode OTP benar. Silakan buat password baru.",
    reset_token: resetToken,
    expires_in_minutes: RESET_TOKEN_TTL_MINUTES
  });
};

// 3. SIMPAN PASSWORD BARU
const resetPassword = async (req, res) => {
  const email = cleanEmail(req.body.email);
  const { reset_token, new_password } = req.body;

  if (!email || !reset_token) throw new AppError("Sesi reset tidak valid. Silakan ulangi dari awal.", 400);
  if (!new_password) throw new AppError("Password baru wajib diisi.", 400);
  if (new_password.length < 6) throw new AppError("Password baru minimal 6 karakter.", 400);

  const record = await prisma.passwordReset.findUnique({ where: { email } });
  if (!record || !record.reset_token) {
    throw new AppError("Sesi reset tidak valid. Silakan minta kode OTP baru.", 401);
  }

  if (!record.token_expires_at || isOtpExpired(record.token_expires_at)) {
    await prisma.passwordReset.delete({ where: { email } });
    throw new AppError("Sesi reset kedaluwarsa. Silakan minta kode OTP baru.", 401);
  }

  if (!safeEqual(record.reset_token, hashToken(reset_token))) {
    throw new AppError("Token reset tidak valid.", 401);
  }

  const userDetail = await prisma.userDetail.findUnique({ where: { email } });
  if (!userDetail) throw new AppError("User tidak ditemukan.", 404);

  const isSame = await comparePassword(new_password, userDetail.password_hash);
  if (isSame) throw new AppError("Password baru tidak boleh sama dengan password lama.", 400);

  const newHashed = await hashPassword(new_password);

  await prisma.$transaction([
    prisma.userDetail.update({
      where: { email },
      data: { password_hash: newHashed, updated_at: new Date() }
    }),
    prisma.passwordReset.delete({ where: { email } })
  ]);

  logger.info(`Password berhasil direset untuk ${email}`);

  res.status(200).json({
    status: "success",
    message: "Password berhasil diubah! Silakan login dengan password baru."
  });
};

module.exports = { forgotPassword, verifyResetOtp, resetPassword };