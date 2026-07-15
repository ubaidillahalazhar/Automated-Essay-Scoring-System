// File: backend/src/controllers/scoringController.js
//
// Controller TIPIS + tanpa try/catch. Error dilempar via throw / AppError,
// lalu ditangani oleh middleware errorHandler (Express 5 meneruskannya otomatis).

const prisma = require('../config/prismaClient');
const { gradeAndSaveScore } = require('../services/scoringService');
const { AppError } = require('../middleware/errorHandler');

/**
 * POST — Submit satu jawaban lalu langsung dinilai AI.
 * Body: { user_id, question_id, answer_text }
 */
const submitAnswerAndGrade = async (req, res) => {
  const { user_id, question_id, answer_text } = req.body;

  // 1. Ambil teks Soal + Kunci Jawaban dari Database
  const questionData = await prisma.essayQuestion.findUnique({
    where: { question_id: question_id },
    include: { answerKey: true },
  });

  if (!questionData || !questionData.answerKey) {
    throw new AppError('Soal atau Kunci Jawaban tidak ditemukan', 404);
  }

  // 2. Simpan Jawaban Murid ke tabel StudentAnswer
  const studentAnswer = await prisma.studentAnswer.create({
    data: {
      user_id: user_id,
      question_id: question_id,
      answer_text: answer_text,
      word_count: answer_text.trim().split(/\s+/).filter(Boolean).length,
    },
  });

  // 3. Serahkan penilaian + penyimpanan Score ke service
  const { score: finalScore } = await gradeAndSaveScore(studentAnswer, questionData);

  // 4. Respons sukses
  res.status(200).json({
    message: 'Jawaban berhasil dikirim dan dinilai oleh AI',
    data: {
      answer: studentAnswer,
      score: finalScore,
    },
  });
};

module.exports = { submitAnswerAndGrade };
