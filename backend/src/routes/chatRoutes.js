const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { createRateLimiter } = require('../middleware/rateLimitMiddleware');
const { sendMessage, listProviders } = require('../controllers/chatController');

const chatLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  label: 'chat/user',
  keyFn: (req) => (req.user?.userId ? `user:${req.user.userId}` : `ip:${req.ip}`),
  message: 'Terlalu banyak pertanyaan dalam waktu singkat. Tunggu sebentar ya.'
});

router.get('/providers', authenticateToken, listProviders);
router.post('/', authenticateToken, chatLimiter, sendMessage);

module.exports = router;
