const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  register, verifyOtp, login,
  getProfile, updateProfile, changePassword
} = require('../controllers/authController');

// Public
router.post('/register', register);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);

// Protected
router.get('/profile/:user_id', authenticateToken, getProfile);
router.put('/profile/:user_id', authenticateToken, updateProfile);
router.put('/password/:user_id', authenticateToken, changePassword);

module.exports = router;