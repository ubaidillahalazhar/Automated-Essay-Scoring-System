
const prisma = require('../config/prismaClient');
const { gradeEssayWithAI } = require('./aiService');
const logger = require('../utils/loggerUtils');

/**
 * @param {{skor?: number, nilai_100?: number, alasan?: string}} aiResult
 * @returns {{skor10: number, skor100: number}}
 */
function normalizeAiScore(aiResult) {
  // AI service returns skor on 0.0–1.0 scale
  const skorRaw = Math.max(0, Math.min(1, Number(aiResult?.skor) || 0));
  const skor10  = Math.round(skorRaw * 10 * 100) / 100;   // 0–10 scale
  const skor100 = Math.round(skorRaw * 100 * 100) / 100;  // 0–100 scale
  return { skor10, skor100 };
}

/**
 * @param {{answer_id: number, answer_text: string}} answer
 * @param {{question_text: string, answerKey?: {key_text: string}|null}|null} question
 * @returns {Promise<{answer_id: number, score: object, error: boolean}>}
 */
async function gradeAndSaveScore(answer, question) {

  if (!question || !question.answerKey) {
    logger.error(
      `Invariant dilanggar: soal tanpa kunci jawaban saat menilai ` +
      `answer_id=${answer.answer_id}. Perlu pengecekan integritas data.`
    );
    const score = await prisma.score.create({
      data: {
        answer_id: answer.answer_id,
        ai_score: 0,
        final_score: 0,
        feedback:
          'Kunci jawaban tidak ditemukan (data tidak konsisten). ' +
          'Perlu dinilai manual oleh guru.',
        is_approved: false,
      },
    });
    return { answer_id: answer.answer_id, score, error: true };
  }

  try {
    const aiResult = await gradeEssayWithAI(
      question.question_text,
      question.answerKey.key_text,
      answer.answer_text
    );

    const { skor10, skor100 } = normalizeAiScore(aiResult);

    if (
      typeof aiResult?.nilai_100 === 'number' &&
      Math.abs(aiResult.nilai_100 - skor100) > 0.01
    ) {
      logger.warn(
        `AI nilai_100 inkonsisten dengan skor*100 ` +
        `(skor=${aiResult.skor}, nilai_100=${aiResult.nilai_100}, dipakai=${skor100}). ` +
        `answer_id=${answer.answer_id}`
      );
    }

    const score = await prisma.score.create({
      data: {
        answer_id: answer.answer_id,
        ai_score: skor10,
        final_score: skor100,
        feedback: aiResult.alasan,
        is_approved: false,
      },
    });

    return { answer_id: answer.answer_id, score, error: false };
  } catch (aiError) {
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
