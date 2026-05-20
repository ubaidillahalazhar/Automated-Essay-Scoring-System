const prisma = require('../config/prismaClient');
const { gradeEssayWithAI } = require('../services/aiService');

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
        word_count: answer_text.split(/\s+/).length // Hitung kata sederhana
      }
    });

    // 4. Kirim ke AI Service untuk dinilai
    const aiResult = await gradeEssayWithAI(
      questionData.question_text,
      questionData.answerKey.key_text,
      answer_text
    );

    // 5. Simpan hasil penilaian AI ke tabel Score
    // (Perhatikan: scored_by tidak diisi karena ini otomatis dari AI)
    const finalScore = await prisma.score.create({
      data: {
        answer_id: studentAnswer.answer_id,
        ai_score: aiResult.skor,
        final_score: aiResult.nilai_100, // Jika kamu ingin menyimpan skala 100 di database
        feedback: aiResult.alasan
      }
    });

    // 6. Kembalikan respons sukses ke Frontend
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