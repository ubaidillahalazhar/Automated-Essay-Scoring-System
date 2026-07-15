// File: backend/src/utils/loggerUtils.js
//
// Logger terpusat yang ringan — pembungkus tipis di atas console.
// Tujuannya menyeragamkan semua log (timestamp + level konsisten) tanpa
// menambah dependency berat. Pemakaiannya persis seperti console:
//
//   const logger = require('../utils/loggerUtils');
//   logger.info('Server berjalan di port', PORT);
//   logger.warn('AI nilai_100 inkonsisten', { answer_id });
//   logger.error('Gagal submit:', error);
//
// Level bisa diatur lewat env LOG_LEVEL (error | warn | info | debug).
// Default 'info'. Saat NODE_ENV=test, default jadi 'error' supaya output
// test bersih. Angka lebih kecil = lebih penting.

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const defaultLevel = process.env.NODE_ENV === 'test' ? 'error' : 'info';
const configuredLevel = (process.env.LOG_LEVEL || defaultLevel).toLowerCase();
const threshold = LEVELS[configuredLevel] ?? LEVELS.info;

function timestamp() {
  return new Date().toISOString();
}

/**
 * Inti logger: cetak hanya kalau level-nya cukup penting.
 * @param {'error'|'warn'|'info'|'debug'} level
 * @param {string} emoji  Penanda visual di awal baris.
 * @param {Function} consoleFn  Metode console yang dipakai.
 * @param {...any} args  Sama seperti argumen console (boleh termasuk objek Error).
 */
function write(level, emoji, consoleFn, ...args) {
  if (LEVELS[level] > threshold) return;
  consoleFn(`${timestamp()} ${emoji} [${level.toUpperCase()}]`, ...args);
}

const logger = {
  error: (...args) => write('error', '❌', console.error, ...args),
  warn: (...args) => write('warn', '⚠️', console.warn, ...args),
  info: (...args) => write('info', 'ℹ️', console.log, ...args),
  debug: (...args) => write('debug', '🐛', console.log, ...args),
};

module.exports = logger;
