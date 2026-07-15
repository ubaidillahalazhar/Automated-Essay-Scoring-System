// File: backend/src/middleware/errorHandler.js
//
// Penanganan error terpusat. Dengan ini, controller tidak perlu lagi menulis
// try/catch + res.status(500) berulang-ulang. Cukup `throw` — Express 5
// otomatis meneruskan error dari handler async ke middleware ini.
//
//   throw new AppError('Kuis tidak ditemukan', 404);
//
// Untuk error tak terduga (bukan AppError), status default 500 dan pesan
// aslinya TIDAK dibocorkan ke client (hanya dicatat di log).

const logger = require('../utils/loggerUtils');

/**
 * Error operasional dengan HTTP status code.
 * Pakai ini untuk error yang "diharapkan" (validasi, not found, forbidden).
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // menandai ini error yang kita lempar sendiri
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Middleware untuk route yang tidak cocok dengan apa pun (404).
 * Pasang SETELAH semua route, SEBELUM errorHandler.
 */
const notFound = (req, res, next) => {
  next(new AppError(`Route tidak ditemukan: ${req.method} ${req.originalUrl}`, 404));
};

/**
 * Middleware error terpusat. WAJIB punya 4 argumen (err, req, res, next) —
 * itulah cara Express mengenalinya sebagai error handler. Pasang PALING AKHIR.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const statusCode =
    Number.isInteger(err.statusCode) && err.statusCode >= 400 ? err.statusCode : 500;
  const isServerError = statusCode >= 500;

  // 5xx = masalah server (dicatat lengkap). 4xx = kesalahan client (cukup warn).
  if (isServerError) {
    logger.error(`${req.method} ${req.originalUrl} →`, err);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} → ${err.message}`);
  }

  // Untuk 5xx jangan bocorkan detail internal ke client.
  const clientMessage = isServerError ? 'Terjadi kesalahan pada server.' : err.message;

  const body = { status: 'error', message: clientMessage };

  // Di non-production, sertakan detail asli untuk mempermudah debugging.
  if (process.env.NODE_ENV !== 'production' && isServerError) {
    body.detail = err.message;
  }

  res.status(statusCode).json(body);
};

module.exports = { AppError, notFound, errorHandler };
