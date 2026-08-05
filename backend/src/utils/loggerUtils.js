
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const defaultLevel = process.env.NODE_ENV === 'test' ? 'error' : 'info';
const configuredLevel = (process.env.LOG_LEVEL || defaultLevel).toLowerCase();
const threshold = LEVELS[configuredLevel] ?? LEVELS.info;

function timestamp() {
  return new Date().toISOString();
}

/**
 * @param {'error'|'warn'|'info'|'debug'} level
 * @param {string} emoji
 * @param {Function} consoleFn
 * @param {...any} args 
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
