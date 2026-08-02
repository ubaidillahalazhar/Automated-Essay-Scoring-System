
const prisma = require('../config/prismaClient');
const { gradeAndSaveScore } = require('../services/scoringService');
const { AppError } = require('../middleware/errorHandler');


const submitAnswerAndGrade = async (req, res) => {
  const { user_id, question_id, answer_text } = req.body;


  const userId = parseInt(user_id, 10);
  const questionId = parseInt(question_id, 10);
  if (!userId || !questionId) {
    throw new AppError('user_id dan question_id wajib berupa angka yang valid.', 400);
  }
  if (typeof answer_text !== 'string' || !answer_text.trim()) {
    throw new AppError('answer_text wajib diisi.', 400);
  }

  const questionData = await prisma.essayQuestion.findUnique({
    where: { question_id: questionId },
    include: { answerKey: true },
  });


  if (!questionData) {
    throw new AppError('Soal tidak ditemukan.', 404);
  }

  if (!questionData.answerKey) {
    throw new AppError('Data tidak konsisten: soal tidak memiliki kunci jawaban.', 500);
  }

  const studentAnswer = await prisma.studentAnswer.create({
    data: {
      user_id: userId,
      question_id: questionId,
      answer_text: answer_text,
      word_count: answer_text.trim().split(/\s+/).filter(Boolean).length,
    },
  });

  const { score: finalScore } = await gradeAndSaveScore(studentAnswer, questionData);

  res.status(201).json({
    message: 'Jawaban berhasil dikirim dan dinilai oleh AI',
    data: {
      answer: studentAnswer,
      score: finalScore,
    },
  });
};

module.exports = { submitAnswerAndGrade };
