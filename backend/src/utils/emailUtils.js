const nodemailer = require('nodemailer');
const logger = require('./loggerUtils');
const { OTP_TTL_MINUTES } = require('./otpUtils');

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }
  return transporter;
};

const sendMail = async (toEmail, subject, text, label) => {
  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject,
      text
    });
    logger.info(`Email ${label} berhasil dikirim ke ${toEmail}`);
  } catch (error) {
    logger.error(`Gagal mengirim email ${label}:`, error);
    throw new Error(`Gagal mengirim email ${label}`);
  }
};

const sendOtpEmail = async (toEmail, otpCode) => {
  await sendMail(
    toEmail,
    'Kode OTP Login - Automated Essay Scoring',
    `Halo!\n\nIni adalah kode OTP Anda untuk masuk ke sistem: ${otpCode}\n\nKode ini berlaku selama ${OTP_TTL_MINUTES} menit. Jangan berikan kode ini kepada siapa pun.`,
    'OTP'
  );
};

const sendResetPasswordEmail = async (toEmail, otpCode) => {
  await sendMail(
    toEmail,
    'Kode Reset Password - Automated Essay Scoring',
    `Halo!\n\nKami menerima permintaan reset password untuk akun ini.\n\n` +
    `Kode verifikasi Anda: ${otpCode}\n\n` +
    `Kode berlaku selama ${OTP_TTL_MINUTES} menit dan hanya bisa dipakai sekali. ` +
    `Jangan berikan kode ini kepada siapa pun.\n\n` +
    `Jika Anda tidak meminta reset password, abaikan email ini. Password lama Anda tetap aman.`,
    'reset password'
  );
};

module.exports = { sendOtpEmail, sendResetPasswordEmail };