// File: backend/src/utils/otpUtils.js
//
// Helper generik seputar OTP: membuat kode, menghitung waktu kedaluwarsa,
// dan mengecek apakah OTP sudah lewat masa berlaku.
//
// Catatan: file ini TIDAK mengirim email (itu tugas emailUtils.js) dan TIDAK
// menyentuh database (itu tugas controller). Murni logika OTP.

// Masa berlaku OTP default (menit). Bisa di-override lewat env OTP_TTL_MINUTES.
const OTP_TTL_MINUTES = parseInt(process.env.OTP_TTL_MINUTES || '5', 10);

/**
 * Buat kode OTP numerik acak.
 * Default 6 digit (100000–999999).
 *
 * @param {number} length Jumlah digit (default 6).
 * @returns {string} Kode OTP sebagai string (menjaga leading zero bila length > 6).
 */
function generateOtp(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

/**
 * Hitung timestamp kedaluwarsa OTP dari sekarang.
 *
 * @param {number} minutes Masa berlaku dalam menit (default OTP_TTL_MINUTES).
 * @returns {Date} Waktu kedaluwarsa.
 */
function getOtpExpiry(minutes = OTP_TTL_MINUTES) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Cek apakah OTP sudah kedaluwarsa.
 *
 * @param {Date|string|number} expiresAt Waktu kedaluwarsa yang tersimpan di DB.
 * @returns {boolean} true bila sudah lewat masa berlaku.
 */
function isOtpExpired(expiresAt) {
  return new Date() > new Date(expiresAt);
}

module.exports = { generateOtp, getOtpExpiry, isOtpExpired, OTP_TTL_MINUTES };
