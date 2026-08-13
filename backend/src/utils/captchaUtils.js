/**
 * captchaUtils.js
 * ---------------------------------------------------------------------------
 * CAPTCHA mandiri (self-hosted), tanpa dependency baru.
 *
 * Tiga mode, diatur lewat env CAPTCHA_MODE:
 *   - "text"      : gambar SVG berisi 5 huruf/angka yang harus diketik ulang.
 *   - "image"     : grid 9 gambar, user memilih semua yang sesuai kategori.
 *   - "recaptcha" : Google reCAPTCHA v3, tanpa interaksi user.
 *
 * Mode text & image stateless: jawaban TIDAK disimpan di server. Server
 * mengirim token ber-signature HMAC yang berisi hash jawaban + nonce + waktu
 * kedaluwarsa. Pola ini sengaja sama dengan attemptTokenUtils.js di repo.
 *
 * Env:
 *   CAPTCHA_ENABLED       default true
 *   CAPTCHA_MODE          "text" | "image" | "recaptcha"   default "text"
 *   CAPTCHA_SECRET        default ikut JWT_SECRET
 *   CAPTCHA_TTL_MS        default 300000 (5 menit)
 *   CAPTCHA_IMAGE_DIR     default <backend>/assets/captcha
 *
 * Khusus mode "recaptcha":
 *   RECAPTCHA_SITE_KEY    kunci publik, dipakai frontend
 *   RECAPTCHA_SECRET_KEY  kunci rahasia, hanya di server
 *   RECAPTCHA_MIN_SCORE   ambang skor 0.0-1.0, default 0.5
 *   RECAPTCHA_VERIFY_URL  default endpoint siteverify Google.
 *                         Ganti ke URL Turnstile bila memakai Cloudflare.
 */

const crypto = require('crypto');
const fs = require('fs');
const { version } = require('os');
const path = require('path');

const SECRET = process.env.CAPTCHA_SECRET || process.env.JWT_SECRET;
const TTL_MS = parseInt(process.env.CAPTCHA_TTL_MS || '', 10) || 5 * 60 * 1000;

const IMAGE_DIR = process.env.CAPTCHA_IMAGE_DIR
  || path.join(__dirname, '..', '..', 'assets', 'captcha');

// Huruf/angka yang mudah dibedakan: tanpa 0/O, 1/I/L
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const TEXT_LENGTH = 5;

const INK_COLORS = ['#1f2937', '#0f766e', '#7c2d12', '#3730a3', '#831843'];

const GRID_SIZE = 9;                 // jumlah kotak
const MIN_CORRECT = 2;               // minimal gambar benar per soal
const MAX_CORRECT = 4;               // maksimal gambar benar per soal
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const RECAPTCHA_VERIFY_URL = process.env.RECAPTCHA_VERIFY_URL
  || 'https://www.google.com/recaptcha/api/siteverify';
const RECAPTCHA_MIN_SCORE = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '') || 0.5;
const RECAPTCHA_TIMEOUT_MS = 8000;
const RECAPTCHA_VERSION =
  String(process.env.RECAPTCHA_VERSION || 'v2').toLowerCase() === 'v3' ? 'v3' : 'v2';

/* ─── Helper dasar ───────────────────────────────────────────────────────── */

const randInt = (min, max) => min + crypto.randomInt(max - min + 1);

const sign = (payload) =>
  crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');

const hashAnswer = (nonce, normalized) =>
  crypto.createHmac('sha256', SECRET).update(`${nonce}:${normalized}`).digest('base64url');

const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

const shuffle = (arr) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * Menyeragamkan jawaban supaya bentuk apa pun dari client menghasilkan
 * string yang sama sebelum di-hash.
 *  - mode text  : "b7k2m"              → "B7K2M"
 *  - mode image : [4,0,7] atau "4,0,7" → "0,4,7"
 */
const normalizeAnswer = (answer, mode) => {
  if (mode === 'image') {
    const list = Array.isArray(answer) ? answer : String(answer ?? '').split(',');
    const indexes = list
      .map((v) => parseInt(v, 10))
      .filter((v) => Number.isInteger(v) && v >= 0 && v < GRID_SIZE);
    return [...new Set(indexes)].sort((a, b) => a - b).join(',');
  }
  return String(answer ?? '').replace(/\s+/g, '').toUpperCase();
};

/* ─── Anti-replay ────────────────────────────────────────────────────────── */
/**
 * Token stateless bisa dipakai ulang selama masa berlaku. Kita simpan token
 * yang sudah terpakai di memori sampai token itu kedaluwarsa sendiri.
 * Catatan deployment: kalau backend dijalankan lebih dari satu instance,
 * ganti Map ini dengan Redis (SET NX + TTL) agar anti-replay tetap berlaku.
 */
const usedTokens = new Map();

const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [token, expiresAt] of usedTokens) {
    if (expiresAt <= now) usedTokens.delete(token);
  }
}, 60_000);
if (typeof sweeper.unref === 'function') sweeper.unref();

/* ─── Penyegelan path gambar ─────────────────────────────────────────────── */
/**
 * URL gambar tidak boleh membocorkan nama kategori. Kalau alamatnya
 * /captcha/tas/3.jpg, bot cukup membaca URL-nya tanpa melihat gambarnya sama
 * sekali. Jadi path dienkripsi (AES-GCM), bukan sekadar di-encode base64.
 */
const SEAL_KEY = crypto.createHash('sha256').update(`captcha-image:${SECRET}`).digest();

function sealPath(relPath, expiresAt) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', SEAL_KEY, iv);
  const data = Buffer.concat([
    cipher.update(`${relPath}|${expiresAt}`, 'utf8'),
    cipher.final()
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}

/**
 * @returns {string|null} path relatif gambar, atau null kalau tidak sah/kedaluwarsa
 */
function openSeal(sealed) {
  try {
    const raw = Buffer.from(String(sealed), 'base64url');
    if (raw.length < 29) return null;

    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', SEAL_KEY, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');

    const sep = plain.lastIndexOf('|');
    if (sep === -1) return null;

    const relPath = plain.slice(0, sep);
    const expiresAt = Number(plain.slice(sep + 1));
    if (!expiresAt || expiresAt <= Date.now()) return null;

    // Sabuk pengaman kedua: tolak path yang mencoba keluar dari folder captcha
    if (relPath.includes('..') || path.isAbsolute(relPath)) return null;

    return relPath;
  } catch {
    return null;   // signature salah, isi diubah, atau bukan base64url
  }
}

/* ─── Katalog gambar ─────────────────────────────────────────────────────── */
/**
 * Struktur folder yang diharapkan:
 *   assets/captcha/tas/*.jpg
 *   assets/captcha/buku/*.jpg
 * Nama folder dipakai langsung sebagai kata pada perintah ("Pilih semua tas").
 */
let catalogCache = null;
let catalogLoadedAt = 0;
const CATALOG_TTL_MS = 5 * 60 * 1000;

function loadCatalog() {
  const now = Date.now();
  if (catalogCache && now - catalogLoadedAt < CATALOG_TTL_MS) return catalogCache;

  const catalog = {};
  try {
    for (const entry of fs.readdirSync(IMAGE_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const files = fs.readdirSync(path.join(IMAGE_DIR, entry.name))
        .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
        .map((f) => `${entry.name}/${f}`);
      if (files.length > 0) catalog[entry.name] = files;
    }
  } catch {
    // Folder belum dibuat: katalog kosong, nanti otomatis jatuh ke mode teks
  }

  catalogCache = catalog;
  catalogLoadedAt = now;
  return catalog;
}

/** Paksa baca ulang folder (dipakai setelah menambah gambar tanpa restart). */
const refreshCatalog = () => { catalogCache = null; return loadCatalog(); };

/**
 * Mode gambar hanya bisa jalan kalau ada minimal 2 kategori dan cukup gambar
 * untuk mengisi 9 kotak. Kalau tidak, kita jatuh ke mode teks daripada
 * menampilkan soal yang rusak.
 */
function imageModeReady() {
  const catalog = loadCatalog();
  const categories = Object.keys(catalog);
  if (categories.length < 2) return false;

  const totalImages = categories.reduce((sum, c) => sum + catalog[c].length, 0);
  const biggest = Math.max(...categories.map((c) => catalog[c].length));
  return biggest >= MIN_CORRECT && totalImages >= GRID_SIZE;
}

/* ─── Render SVG (mode teks) ─────────────────────────────────────────────── */

const WIDTH = 180;
const HEIGHT = 60;

const randomText = () => {
  let out = '';
  for (let i = 0; i < TEXT_LENGTH; i++) out += CHARSET[crypto.randomInt(CHARSET.length)];
  return out;
};

function renderSvg(text) {
  const parts = [];

  for (let i = 0; i < 5; i++) {
    const x1 = randInt(0, WIDTH);
    const y1 = randInt(0, HEIGHT);
    const x2 = randInt(0, WIDTH);
    const y2 = randInt(0, HEIGHT);
    const color = INK_COLORS[randInt(0, INK_COLORS.length - 1)];
    parts.push(
      `<path d="M${x1} ${y1} Q${randInt(0, WIDTH)} ${randInt(0, HEIGHT)} ${x2} ${y2}" ` +
      `stroke="${color}" stroke-opacity="0.35" stroke-width="1.5" fill="none"/>`
    );
  }

  const slot = WIDTH / (TEXT_LENGTH + 1);
  text.split('').forEach((char, idx) => {
    const x = slot * (idx + 1) + randInt(-4, 4);
    const y = HEIGHT / 2 + randInt(6, 12);
    const rotate = randInt(-28, 28);
    const size = randInt(28, 36);
    const color = INK_COLORS[randInt(0, INK_COLORS.length - 1)];
    parts.push(
      `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" ` +
      `font-family="Verdana,DejaVu Sans,sans-serif" font-weight="700" ` +
      `text-anchor="middle" transform="rotate(${rotate} ${x} ${y})">${char}</text>`
    );
  });

  for (let i = 0; i < 40; i++) {
    parts.push(
      `<circle cx="${randInt(0, WIDTH)}" cy="${randInt(0, HEIGHT)}" r="${randInt(1, 2)}" ` +
      `fill="#111827" fill-opacity="0.25"/>`
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" ` +
    `viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Kode keamanan">` +
    `<rect width="${WIDTH}" height="${HEIGHT}" rx="10" fill="#f8fafc"/>` +
    parts.join('') +
    `</svg>`
  );
}

/* ─── Pembuat soal ───────────────────────────────────────────────────────── */

function buildToken(mode, normalizedAnswer, expiresAt) {
  const nonce = crypto.randomBytes(9).toString('base64url');
  const payload = Buffer.from(
    `${mode}:${hashAnswer(nonce, normalizedAnswer)}:${nonce}:${expiresAt}`,
    'utf8'
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function issueTextCaptcha() {
  const text = randomText();
  const expiresAt = Date.now() + TTL_MS;
  const svg = renderSvg(text);

  return {
    mode: 'text',
    token: buildToken('text', normalizeAnswer(text, 'text'), expiresAt),
    image: `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`,
    expires_in: Math.floor(TTL_MS / 1000)
  };
}

function issueImageCaptcha() {
  const catalog = loadCatalog();
  const expiresAt = Date.now() + TTL_MS;

  // Kategori target = yang punya cukup gambar untuk jadi jawaban benar
  const eligible = Object.keys(catalog).filter((c) => catalog[c].length >= MIN_CORRECT);
  const target = eligible[crypto.randomInt(eligible.length)];

  const maxCorrect = Math.min(MAX_CORRECT, catalog[target].length, GRID_SIZE - 1);
  const correctCount = randInt(MIN_CORRECT, Math.max(MIN_CORRECT, maxCorrect));

  const correctFiles = shuffle(catalog[target]).slice(0, correctCount);

  // Pengecoh diambil dari semua kategori lain
  const otherFiles = Object.keys(catalog)
    .filter((c) => c !== target)
    .flatMap((c) => catalog[c]);
  const decoyFiles = shuffle(otherFiles).slice(0, GRID_SIZE - correctFiles.length);

  const tiles = shuffle([
    ...correctFiles.map((file) => ({ file, correct: true })),
    ...decoyFiles.map((file) => ({ file, correct: false }))
  ]);

  const answerIndexes = tiles
    .map((tile, idx) => (tile.correct ? idx : -1))
    .filter((idx) => idx !== -1);

  return {
    mode: 'image',
    token: buildToken('image', normalizeAnswer(answerIndexes, 'image'), expiresAt),
    prompt: target,
    images: tiles.map((tile) => sealPath(tile.file, expiresAt)),
    expires_in: Math.floor(TTL_MS / 1000)
  };
}

/**
 * Mode reCAPTCHA hanya bisa jalan kalau kedua kunci sudah diisi.
 */
const recaptchaReady = () =>
  Boolean(process.env.RECAPTCHA_SITE_KEY && process.env.RECAPTCHA_SECRET_KEY);

function issueRecaptchaChallenge() {
  const expiresAt = Date.now() + TTL_MS;
  return {
    mode: 'recaptcha',
    version: RECAPTCHA_VERSION,
    // Token server tetap dipakai sebagai penanda mode + masa berlaku.
    // Verifikasi aslinya dilakukan Google lewat siteverify.
    token: buildToken('recaptcha', 'n/a', expiresAt),
    site_key: process.env.RECAPTCHA_SITE_KEY,
    expires_in: Math.floor(TTL_MS / 1000)
  };
}

/**
 * Tiket lulus: diterbitkan HANYA setelah user menjawab soal dengan benar.
 * Dipakai halaman login sebagai ganti jawaban asli, mirip response token
 * milik reCAPTCHA v2. Umurnya pendek supaya tidak bisa ditimbun.
 */
const PASS_TTL_MS = 10 * 60 * 1000;

function issuePassToken() {
  return buildToken('pass', 'ok', Date.now() + PASS_TTL_MS);
}

/**
 * Membuat CAPTCHA baru sesuai CAPTCHA_MODE.
 * Kalau mode yang diminta belum siap (folder gambar kosong, atau kunci
 * reCAPTCHA belum diisi), otomatis memakai mode teks supaya login tidak
 * pernah buntu.
 */
function issueCaptcha() {
  const mode = String(process.env.CAPTCHA_MODE || 'text').toLowerCase();
  if (mode === 'recaptcha' && recaptchaReady()) return issueRecaptchaChallenge();
  if (mode === 'image' && imageModeReady()) return issueImageCaptcha();
  return issueTextCaptcha();
}

/* ─── Verifikasi reCAPTCHA ke server Google ──────────────────────────────── */

async function verifyRecaptchaToken(responseToken, remoteIp) {
  if (!responseToken || typeof responseToken !== 'string') {
    return { ok: false, message: 'Verifikasi keamanan belum selesai. Muat ulang halaman.' };
  }

  const body = new URLSearchParams({
    secret: process.env.RECAPTCHA_SECRET_KEY,
    response: responseToken
  });
  if (remoteIp) body.append('remoteip', remoteIp);

  let data;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RECAPTCHA_TIMEOUT_MS);

    const res = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal
    });
    clearTimeout(timeout);
    data = await res.json();
  } catch {
    // Google tidak bisa dihubungi: internet mati, diblokir, atau timeout.
    // Sengaja MENOLAK, bukan meloloskan — kalau diloloskan, mematikan koneksi
    // ke Google menjadi cara gampang melewati captcha sepenuhnya.
    return { ok: false, message: 'Verifikasi keamanan gagal dihubungi. Coba lagi sebentar.' };
  }

  if (!data?.success) {
    return { ok: false, message: 'Verifikasi keamanan gagal. Coba lagi.' };
  }

  // v3 mengembalikan skor 0.0-1.0; v2 dan Turnstile tidak punya skor.
  if (typeof data.score === 'number' && data.score < RECAPTCHA_MIN_SCORE) {
    return { ok: false, message: 'Aktivitas mencurigakan terdeteksi. Coba lagi nanti.' };
  }

  return { ok: true };
}

/* ─── Verifikasi ─────────────────────────────────────────────────────────── */

/**
 * @param {string} token           token soal dari server
 * @param {string|number[]} answer teks, daftar indeks kotak, atau token reCAPTCHA
 * @param {string} [remoteIp]      IP pengguna, dikirim ke Google bila ada
 * @returns {Promise<{ok: boolean, message?: string}>}
 */
async function verifyCaptcha(token, answer, remoteIp) {
  const invalid = { ok: false, message: 'Kode keamanan tidak valid. Muat ulang soalnya.' };

  if (typeof token !== 'string' || !token.includes('.')) return invalid;

  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return invalid;

  let mode, answerHash, nonce, expiresAt;
  try {
    const raw = Buffer.from(payload, 'base64url').toString('utf8');
    [mode, answerHash, nonce, expiresAt] = raw.split(':');
  } catch {
    return invalid;
  }

  if (!mode || !answerHash || !nonce) return invalid;

  if (Number(expiresAt) <= Date.now()) {
    return { ok: false, message: 'Soal keamanan sudah kedaluwarsa. Muat ulang soalnya.' };
  }

  if (usedTokens.has(token)) {
    return { ok: false, message: 'Soal keamanan sudah terpakai. Muat ulang soalnya.' };
  }

  // Tiket lulus: keabsahannya sudah dijamin signature HMAC + masa berlaku +
  // sekali pakai yang sudah diperiksa di atas, jadi tidak ada jawaban
  // yang perlu dicocokkan lagi.
  if (mode === 'pass') {
    usedTokens.set(token, Number(expiresAt));
    return { ok: true };
  }

  if (mode === 'recaptcha') {
    const result = await verifyRecaptchaToken(
      Array.isArray(answer) ? answer[0] : answer,
      remoteIp
    );
    if (result.ok) usedTokens.set(token, Number(expiresAt));
    return result;
  }

  const normalized = normalizeAnswer(answer, mode);
  if (!normalized) {
    return mode === 'image'
      ? { ok: false, message: 'Pilih dulu gambarnya.' }
      : { ok: false, message: 'Isi dulu kode keamanannya.' };
  }

  if (!safeEqual(answerHash, hashAnswer(nonce, normalized))) {
    return mode === 'image'
      ? { ok: false, message: 'Pilihan gambarnya belum tepat. Coba lagi.' }
      : { ok: false, message: 'Kode keamanan salah. Coba lagi.' };
  }

  usedTokens.set(token, Number(expiresAt));
  return { ok: true };
}

/**
 * Menerjemahkan id gambar bersegel menjadi path file absolut yang aman dibaca.
 * @returns {string|null}
 */
function resolveImagePath(sealed) {
  const relPath = openSeal(sealed);
  if (!relPath) return null;

  const absolute = path.resolve(IMAGE_DIR, relPath);
  const root = path.resolve(IMAGE_DIR);

  // Pastikan hasilnya benar-benar di dalam folder captcha
  if (absolute !== root && !absolute.startsWith(root + path.sep)) return null;
  if (!fs.existsSync(absolute)) return null;

  return absolute;
}

const isCaptchaEnabled = () => process.env.CAPTCHA_ENABLED !== 'false';

module.exports = {
  issueCaptcha,
  issuePassToken,
  recaptchaReady,
  verifyCaptcha,
  isCaptchaEnabled,
  resolveImagePath,
  refreshCatalog,
  IMAGE_DIR
};