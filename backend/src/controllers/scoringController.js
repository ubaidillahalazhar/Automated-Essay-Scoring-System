const prisma = require('../config/prismaClient');
const { gradeEssayWithAI } = require('../services/aiService');

/**
 * Normalisasi hasil AI grading agar selalu konsisten.
 *
 * Kontrak resmi AI service (lihat SYSTEM_PROMPT di ai-service/main.py):
 *   - skor       : 0-10 (boleh desimal)
 *   - nilai_100  : skor × 10  (skala 0-100)
 *
 * Masalahnya: model kadang return nilai_100 yang TIDAK sama dengan skor*10
 * (mis. {skor: 10, nilai_100: 10} → jawaban sempurna tapi tersimpan 10/100).
 * Maka di sini kita PAKSA konsistensi dengan men-derive nilai_100 dari skor,
 * supaya `final_score` di DB & tampilan frontend selalu betul.
 */
function normalizeAiScore(aiResult) {
  const skor10 = Math.max(0, Math.min(10, Number(aiResult?.skor) || 0));
  // Bulatkan ke 2 desimal supaya pas dengan Decimal(5,2) di Prisma schema.
  const skor100 = Math.round(skor10 * 10 * 100) / 100;
  return { skor10, skor100 };
}

const submitAnswerAndGrade = async (req, res) => {
  try {
    // 1. Tangkap data dari Frontend Next.js
    const { user_id, question_id, answer_text } = req.body;

    // 2. Ambil teks Soal dan Kunci Jawaban dari Database
    const questionData = await prisma.essayQuestion.findUnique({
      where: { question_id: question_id },
      include: { answerKey: true }
    });

    if (!questionData || !questionData.answerKey) {
      return res.status(404).json({ message: "Soal atau Kunci Jawaban tidak ditemukan" });
    }

    // 3. Simpan Jawaban Murid ke tabel StudentAnswer terlebih dahulu
    const studentAnswer = await prisma.studentAnswer.create({
      data: {
        user_id: user_id,
        question_id: question_id,
        answer_text: answer_text,
        word_count: answer_text.trim().split(/\s+/).filter(Boolean).length
      }
    });

    // 4. Kirim ke AI Service untuk dinilai
    const aiResult = await gradeEssayWithAI(
      questionData.question_text,
      questionData.answerKey.key_text,
      answer_text
    );

    // 5. Normalisasi skor — JANGAN langsung pakai aiResult.nilai_100.
    const { skor10, skor100 } = normalizeAiScore(aiResult);

    // Log kalau model mengirim nilai_100 yang inkonsisten — bantu debugging
    // saat model mulai "ngaco" lagi di masa depan.
    if (
      typeof aiResult?.nilai_100 === 'number' &&
      Math.abs(aiResult.nilai_100 - skor100) > 0.01
    ) {
      console.warn(
        `⚠️ AI nilai_100 inkonsisten dengan skor*10 ` +
        `(skor=${aiResult.skor}, nilai_100=${aiResult.nilai_100}, dipakai=${skor100}). ` +
        `answer_id=${studentAnswer.answer_id}`
      );
    }

    // 6. Simpan hasil penilaian AI ke tabel Score
    const finalScore = await prisma.score.create({
      data: {
        answer_id: studentAnswer.answer_id,
        ai_score: skor10,        // skala 0-10 (raw skor dari AI)
        final_score: skor100,    // skala 0-100 (dipakai frontend & total_score)
        feedback: aiResult.alasan
      }
    });

    // 7. Kembalikan respons sukses ke Frontend
    res.status(200).json({
      message: "Jawaban berhasil dikirim dan dinilai oleh AI",
      data: {
        answer: studentAnswer,
        score: finalScore
      }
    });

  } catch (error) {
    console.error("❌ Error Submit Answer:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server", error: error.message });
  }
};

module.exports = { submitAnswerAndGrade };