const express = require('express');
const router = express.Router();
const { login, register, verifyOtp } = require('../controllers/authController');

// Endpoint POST untuk login
router.post('/login', login);
router.post('/register', register);
router.post('/verify-otp', verifyOtp);

module.exports = router;