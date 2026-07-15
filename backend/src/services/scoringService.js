// File: backend/src/services/scoringService.js
//
// Lapisan LOGIKA BISNIS untuk penilaian esai.
// Semua alur "panggil AI -> normalisasi skor -> simpan ke tabel Score"
// dipusatkan di sini, supaya tidak ada duplikasi antara scoringController
// dan examController. Kedua controller cukup memanggil gradeAndSaveScore().

const prisma = require('../config/prismaClient');
const { gradeEssayWithAI } = require('./aiService');
const logger = require('../utils/loggerUtils');
/**
 * Normalisasi hasil AI grading agar selalu konsisten.
 *
 * Kontrak resmi AI service (lihat SYSTEM_PROMPT di ai-service/main.py):
 *   - skor       : 0-10 (boleh desimal)
 *   - nilai_100  : skor x 10  (skala 0-100)
 *
 * Masalahnya: model kadang mengembalikan nilai_100 yang TIDAK sama dengan
 * skor*10 (mis. {skor: 10, nilai_100: 10} -> jawaban sempurna tapi tersimpan
 * 10/100). Maka di sini kita PAKSA konsistensi dengan men-derive nilai_100
 * dari skor, supaya `final_score` di DB & tampilan frontend selalu betul.
 *
 * @param {{skor?: number, nilai_100?: number, alasan?: string}} aiResult
 * @returns {{skor10: number, skor100: number}}
 */
function normalizeAiScore(aiResult) {
  const skor10 = Math.max(0, Math.min(10, Number(aiResult?.skor) || 0));
  // Bulatkan ke 2 desimal supaya pas dengan Decimal(5,2) di Prisma schema.
  const skor100 = Math.round(skor10 * 10 * 100) / 100;
  return { skor10, skor100 };
}

/**
 * Nilai SATU jawaban murid lalu simpan hasilnya ke tabel Score.
 *
 * Fungsi ini menangani sendiri semua kasus tepi:
 *   - Kunci jawaban tidak ada  -> Score fallback 0, perlu dinilai manual.
 *   - AI gagal / timeout        -> Score fallback 0, perlu dinilai manual.
 *   - Sukses                    -> Score dengan skor yang sudah dinormalisasi.
 *
 * Score SELALU dibuat dengan is_approved: false. Guru wajib approve dulu
 * sebelum nilai ditampilkan ke murid.
 *
 * @param {{answer_id: number, answer_text: string}} answer
 *        Record StudentAnswer yang sudah tersimpan (punya answer_id).
 * @param {{question_text: string, answerKey?: {key_text: string}|null}|null} question
 *        EssayQuestion beserta answerKey-nya (hasil include: { answerKey: true }).
 * @returns {Promise<{answer_id: number, score: object, error: boolean}>}
 */
async function gradeAndSaveScore(answer, question) {
  // --- Kasus 1: kunci jawaban tidak ditemukan -> fallback manual ---
  if (!question || !question.answerKey) {
    const score = await prisma.score.create({
      data: {
        answer_id: answer.answer_id,
        ai_score: 0,
        final_score: 0,
        feedback: 'Kunci jawaban tidak ditemukan, perlu dinilai manual.',
        is_approved: false,
      },
    });
    return { answer_id: answer.answer_id, score, error: true };
  }

  // --- Kasus 2: kirim ke AI, normalisasi, simpan ---
  try {
    const aiResult = await gradeEssayWithAI(
      question.question_text,
      question.answerKey.key_text,
      answer.answer_text
    );

    // JANGAN langsung pakai aiResult.nilai_100 — derive dari skor.
    const { skor10, skor100 } = normalizeAiScore(aiResult);

    // Log kalau model mengirim nilai_100 yang inkonsisten dengan skor*10.
    // Membantu debugging saat model mulai "ngaco" lagi di masa depan.
    if (
      typeof aiResult?.nilai_100 === 'number' &&
      Math.abs(aiResult.nilai_100 - skor100) > 0.01
    ) {
      console.warn(
        `⚠️ AI nilai_100 inkonsisten dengan skor*10 ` +
        `(skor=${aiResult.skor}, nilai_100=${aiResult.nilai_100}, dipakai=${skor100}). ` +
        `answer_id=${answer.answer_id}`
      );
    }

    const score = await prisma.score.create({
      data: {
        answer_id: answer.answer_id,
        ai_score: skor10, // skala 0-10 (raw skor dari AI)
        final_score: skor100, // skala 0-100 (dipakai frontend & total_score)
        feedback: aiResult.alasan,
        is_approved: false, // ← WAJIB false, guru harus approve dulu
      },
    });

    return { answer_id: answer.answer_id, score, error: false };
  } catch (aiError) {
    // --- Kasus 3: AI gagal / timeout -> fallback manual ---
    logger.error(`AI gagal answer_id ${answer.answer_id}:`, aiError.message);
    const score = await prisma.score.create({
      data: {
        answer_id: answer.answer_id,
        ai_score: 0,
        final_score: 0,
        feedback: `AI gagal menilai: ${aiError.message}. Mohon dinilai manual oleh guru.`,
        is_approved: false,
      },
    });
    return { answer_id: answer.answer_id, score, error: true };
  }
}

module.exports = { normalizeAiScore, gradeAndSaveScore };
