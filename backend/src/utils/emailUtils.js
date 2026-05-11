const nodemailer = require('nodemailer');

const sendOtpEmail = async (toEmail, otpCode) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject: 'Kode OTP Login - Automated Essay Scoring',
      text: `Halo!\n\nIni adalah kode OTP Anda untuk masuk ke sistem: ${otpCode}\n\nKode ini berlaku selama 5 menit. Jangan berikan kode ini kepada siapa pun.`
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email OTP berhasil dikirim ke ${toEmail}`);
  } catch (error) {
    console.error("Gagal mengirim email:", error);
    throw new Error("Gagal mengirim email OTP");
  }
};

module.exports = { sendOtpEmail };