// File: backend/src/utils/attemptTokenUtils.js
//
// Token untuk mengidentifikasi satu "attempt" (percobaan) pengerjaan kuis.
// Formatnya: <payload>.<signature>
//   - payload   : base64url dari "userId:quizId:timestamp"
//   - signature : HMAC-SHA256 atas payload, di-encode base64url
//
// Tanda tangan HMAC membuat token TIDAK BISA dipalsukan tanpa mengetahui
// secret. Verifikasi memakai crypto.timingSafeEqual untuk mencegah timing
// attack saat membandingkan signature.
//
// Catatan: otorisasi TETAP dicek ulang ke req.user di controller (murid harus
// cocok userId, guru harus pemilik kuis). Tanda tangan ini lapisan tambahan
// (defense-in-depth), bukan satu-satunya penjaga.

const crypto = require('crypto');

// Pakai secret khusus bila ada, jika tidak jatuh ke JWT_SECRET.
// JWT_SECRET dijamin ada karena app.js gagal-start tanpanya.
const TOKEN_SECRET = process.env.ATTEMPT_TOKEN_SECRET || process.env.JWT_SECRET;

/**
 * Hitung HMAC-SHA256 atas payload, hasil base64url.
 * @param {string} payload
 * @returns {string}
 */
function signPayload(payload) {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
}

/**
 * Buat attempt token bertanda tangan.
 * @returns {string} "<payload>.<signature>"
 */
function encodeAttemptToken(userId, quizId, timestamp) {
  const payload = Buffer.from(`${userId}:${quizId}:${timestamp}`, 'utf8').toString('base64url');
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

/**
 * Verifikasi tanda tangan lalu decode isinya.
 * @param {string} token
 * @returns {{userId: number, quizId: number, timestamp: number}|null}
 *          null bila format salah atau tanda tangan tidak valid (dipalsukan).
 */
function decodeAttemptToken(token) {
  try {
    if (typeof token !== 'string' || !token.includes('.')) return null;

    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;

    const expected = signPayload(payload);
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);

    // timingSafeEqual butuh panjang buffer sama; kalau beda, langsung tolak.
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null; // tanda tangan tidak cocok → token rusak / dipalsukan
    }

    const raw = Buffer.from(payload, 'base64url').toString('utf8');
    const [userId, quizId, timestamp] = raw.split(':');
    return {
      userId: parseInt(userId),
      quizId: parseInt(quizId),
      timestamp: parseInt(timestamp),
    };
  } catch (e) {
    return null;
  }
}

module.exports = { encodeAttemptToken, decodeAttemptToken };
