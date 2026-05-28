const express = require('express');
const router = express.Router();
const {
  register,
  verifyOtp,
  login,
  getProfile,
  updateProfile,
  changePassword
} = require('../controllers/authController');

// Auth flow
router.post('/register', register);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);

// Profile management
router.get('/profile/:user_id', getProfile);           // BARU: GET full profile
router.put('/profile/:user_id', updateProfile);        // EXTEND: update name + grade_id
router.put('/password/:user_id', changePassword);      // BARU: change password

module.exports = router;
