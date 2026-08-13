const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  register, verifyOtp, login, getCaptcha, getCaptchaImage, verifyCaptchaChallenge,
  getProfile, updateProfile, changePassword
} = require('../controllers/authController');
const {
  loginByEmail, loginByIp, captchaByIp
} = require('../middleware/rateLimitMiddleware');
const {
  forgotPassword, verifyResetOtp, resetPassword
} = require('../controllers/passwordResetController');

router.post('/register', register);
router.post('/verify-otp', verifyOtp);
router.get('/captcha', captchaByIp, getCaptcha);
router.get('/captcha/image/:id', getCaptchaImage);   // ← baru
router.post('/login', loginByIp, loginByEmail, login);
router.post('/captcha/verify', captchaByIp, verifyCaptchaChallenge)

router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);

router.get('/profile/:user_id', authenticateToken, getProfile);
router.put('/profile/:user_id', authenticateToken, updateProfile);
router.put('/password/:user_id', authenticateToken, changePassword);

module.exports = router;