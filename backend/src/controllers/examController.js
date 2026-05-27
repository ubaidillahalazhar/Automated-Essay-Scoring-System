const prisma = require('../config/prismaClient');
const { gradeEssayWithAI } = require('../services/aiService');

// ==========================================
// HELPER
// ==========================================
const encodeAttemptToken = (userId, quizId, timestamp) => {
  const raw = `${userId}:${quizId}:${timestamp}`;
  return Buffer.from(raw, 'utf8').toString('base64url');
};

const decodeAttemptToken = (token) => {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const [userId, quizId, timestamp] = raw.split(':');
    return {
      userId: parseInt(userId),
      quizId: parseInt(quizId),
      timestamp: parseInt(timestamp)
    };
  } catch (e) {
    return null;
  }
};

/**
 * Helper: Group StudentAnswers menjadi "attempt" virtual.
 * Asumsi: jawaban-jawaban yang submission_date-nya berdekatan (<2 detik antar jawaban)
 * untuk quiz yang sama oleh siswa yang sama = satu attempt.
 */
const groupAnswersIntoAttempts = (answers) => {
  if (answers.length === 0) return [];

  // Sort by user_id, quiz_id, submission_date
  const sorted = [...answers].sort((a, b) => {
    if (a.user_id !== b.user_id) return a.user_id - b.user_id;
    const quizA = a.question.quiz_id;
    const quizB = b.question.quiz_id;
    if (quizA !== quizB) return quizA - quizB;
    return a.submission_date.getTime() - b.submission_date.getTime();
  });

  const attempts = [];
  let currentGroup = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    const sameUser = prev.user_id === curr.user_id;
    const sameQuiz = prev.question.quiz_id === curr.question.quiz_id;
    const timeDiff = Math.abs(curr.submission_date.getTime() - prev.submission_date.getTime());
    // Anggap masih satu attempt kalau jeda < 60 detik (longgar untuk AI grading)
    const sameAttempt = sameUser && sameQuiz && timeDiff < 60_000;

    if (sameAttempt) {
      currentGroup.push(curr);
    } else {
      attempts.push(currentGroup);
      currentGroup = [curr];
    }
  }
  attempts.push(currentGroup);

  return attempts;
};

// ==========================================
// 1. MEMBUAT KUIS & SOAL SEKALIGUS
// ==========================================
const createQuizWithQuestions = async (req, res) => {
  try {
    const {
      title, description, subject_id, timeLimit, targetClass,
      grade_id, dueDate, created_by, questions
    } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const quiz = await tx.quiz.create({
        data: {
          title, description,
          subject_id: parseInt(subject_id),
          time_limit: parseInt(timeLimit),
          grade_id: parseInt(grade_id),
          target_class: targetClass,
          due_date: new Date(dueDate),
          created_by: parseInt(created_by)
        }
      });

      for (const q of questions) {
        const newQuestion = await tx.essayQuestion.create({
          data: {
            quiz_id: quiz.quiz_id,
            question_text: q.text,
            weight: q.points
          }
        });
        await tx.answerKey.create({
          data: {
            question_id: newQuestion.question_id,
            key_text: q.correctAnswer
          }
        });
      }
      return quiz;
    });

    res.status(201).json({
      status: "success",
      message: "Kuis beserta semua soal berhasil dibuat!",
      data: result
    });
  } catch (error) {
    console.error("❌ Error createQuizWithQuestions:", error);
    res.status(500).json({ message: "Gagal membuat kuis", error: error.message });
  }
};

// ==========================================
// 2. MENAMBAHKAN SOAL & KUNCI JAWABAN
// ==========================================
const addQuestionWithKey = async (req, res) => {
  try {
    const { quiz_id, question_text, weight, key_text } = req.body;
    const result = await prisma.$transaction(async (tx) => {
      const newQuestion = await tx.essayQuestion.create({
        data: { quiz_id, question_text, weight: weight || 1.00 }
      });
      const newAnswerKey = await tx.answerKey.create({
        data: { question_id: newQuestion.question_id, key_text }
      });
      return { question: newQuestion, answerKey: newAnswerKey };
    });
    res.status(201).json({ message: "Soal dan Kunci Jawaban berhasil ditambahkan!", data: result });
  } catch (error) {
    console.error("❌ Error addQuestionWithKey:", error);
    res.status(500).json({ message: "Gagal menambahkan soal", error: error.message });
  }
};

// ==========================================
// 3. DAFTAR KUIS MILIK GURU
// ==========================================
const getTeacherQuizzes = async (req, res) => {
  try {
    const { teacher_id } = req.params;
    const quizzes = await prisma.quiz.findMany({
      where: { created_by: parseInt(teacher_id) },
      include: {
        subject: { select: { subject_id: true, subject_name: true } },
        grade:   { select: { grade_id: true, grade_name: true, school_level: true } },
        _count:  { select: { questions: true } }
      },
      orderBy: { created_at: 'desc' }
    });
    res.status(200).json({ message: "Berhasil mengambil data kuis", data: quizzes });
  } catch (error) {
    console.error("❌ Error getTeacherQuizzes:", error);
    res.status(500).json({ message: "Gagal mengambil data kuis", error: error.message });
  }
};

// ==========================================
// 4. DAFTAR KUIS UNTUK MURID (filter by school_level)
// ==========================================
const getAvailableQuizzes = async (req, res) => {
  try {
    const { student_id } = req.params;
    const studentId = parseInt(student_id);

    if (!studentId) return res.status(400).json({ message: "ID siswa tidak valid." });

    const studentDetail = await prisma.userDetail.findUnique({
      where: { user_id: studentId },
      include: { grade: true }
    });

    if (!studentDetail) return res.status(404).json({ message: "Data siswa tidak ditemukan." });
    if (!studentDetail.grade_id || !studentDetail.grade) {
      return res.status(200).json({
        status: "success", data: [],
        message: "Siswa belum punya kelas. Lengkapi profil dulu."
      });
    }

    const schoolLevel = studentDetail.grade.school_level;
    const gradesInSameLevel = await prisma.grade.findMany({
      where: { school_level: schoolLevel },
      select: { grade_id: true }
    });
    const gradeIds = gradesInSameLevel.map(g => g.grade_id);

    const quizzes = await prisma.quiz.findMany({
      where: {
        grade_id: { in: gradeIds },
        due_date: { gte: new Date() }
      },
      include: {
        teacher: { select: { name: true } },
        subject: { select: { subject_name: true } },
        grade: { select: { grade_name: true, school_level: true } },
        _count: { select: { questions: true } }
      },
      orderBy: { created_at: 'desc' }
    });

    const quizIds = quizzes.map(q => q.quiz_id);
    const completedQuizIds = new Set();
    if (quizIds.length > 0) {
      const answers = await prisma.studentAnswer.findMany({
        where: {
          user_id: studentId,
          question: { quiz_id: { in: quizIds } }
        },
        select: { question: { select: { quiz_id: true } } }
      });
      for (const a of answers) completedQuizIds.add(a.question.quiz_id);
    }

    const enriched = quizzes.map(q => ({
      ...q, is_completed: completedQuizIds.has(q.quiz_id)
    }));

    res.status(200).json({
      status: "success",
      data: enriched,
      student_info: {
        grade_id: studentDetail.grade_id,
        grade_name: studentDetail.grade.grade_name,
        school_level: schoolLevel
      }
    });
  } catch (error) {
    console.error("❌ Error getAvailableQuizzes:", error);
    res.status(500).json({ message: "Gagal mengambil kuis", error: error.message });
  }
};

// ==========================================
// 5. MURID MEMBUKA KUIS
// ==========================================
const getQuizQuestions = async (req, res) => {
  try {
    const { quiz_id } = req.params;
    const quiz = await prisma.quiz.findUnique({
      where: { quiz_id: parseInt(quiz_id) },
      include: {
        teacher: { select: { name: true } },
        subject: { select: { subject_name: true } },
        grade: { select: { grade_name: true, school_level: true } },
        questions: {
          select: { question_id: true, question_text: true, weight: true },
          orderBy: { question_id: 'asc' }
        }
      }
    });
    if (!quiz) return res.status(404).json({ message: "Kuis tidak ditemukan" });
    res.status(200).json({ status: "success", data: quiz });
  } catch (error) {
    res.status(500).json({ message: "Gagal memuat soal", error: error.message });
  }
};

// ==========================================
// 6. SUBMIT JAWABAN + PENILAIAN AI
// ==========================================
const submitAnswers = async (req, res) => {
  try {
    const { quiz_id } = req.params;
    const { user_id, answers, time_taken } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: "Tidak ada jawaban yang dikirim." });
    }

    const submitTimestamp = Date.now();

    const submittedAnswers = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const ans of answers) {
        const wordCount = ans.answer_text.trim().split(/\s+/).filter(Boolean).length;
        const newAnswer = await tx.studentAnswer.create({
          data: {
            question_id: parseInt(ans.question_id),
            user_id: parseInt(user_id),
            answer_text: ans.answer_text,
            word_count: wordCount
          }
        });
        created.push(newAnswer);
      }
      return created;
    });

    const questionIds = submittedAnswers.map(a => a.question_id);
    const questionsWithKey = await prisma.essayQuestion.findMany({
      where: { question_id: { in: questionIds } },
      include: { answerKey: true }
    });
    const questionMap = new Map(questionsWithKey.map(q => [q.question_id, q]));

    const scoreResults = [];
    for (const ans of submittedAnswers) {
      const q = questionMap.get(ans.question_id);

      if (!q || !q.answerKey) {
        const fallback = await prisma.score.create({
          data: {
            answer_id: ans.answer_id, ai_score: 0, final_score: 0,
            feedback: "Kunci jawaban tidak ditemukan, soal ini perlu dinilai manual."
          }
        });
        scoreResults.push({
          answer_id: ans.answer_id, question_id: ans.question_id,
          ai_score: 0, final_score: 0, feedback: fallback.feedback, error: true
        });
        continue;
      }

      try {
        const aiResult = await gradeEssayWithAI(
          q.question_text, q.answerKey.key_text, ans.answer_text
        );
        const savedScore = await prisma.score.create({
          data: {
            answer_id: ans.answer_id,
            ai_score: aiResult.skor,
            final_score: aiResult.nilai_100,
            feedback: aiResult.alasan
          }
        });
        scoreResults.push({
          answer_id: ans.answer_id, question_id: ans.question_id,
          ai_score: Number(savedScore.ai_score),
          final_score: Number(savedScore.final_score),
          feedback: savedScore.feedback, error: false
        });
      } catch (aiError) {
        console.error(`❌ AI gagal answer_id ${ans.answer_id}:`, aiError.message);
        const fallback = await prisma.score.create({
          data: {
            answer_id: ans.answer_id, ai_score: 0, final_score: 0,
            feedback: `AI gagal menilai: ${aiError.message}. Mohon dinilai manual oleh guru.`
          }
        });
        scoreResults.push({
          answer_id: ans.answer_id, question_id: ans.question_id,
          ai_score: 0, final_score: 0, feedback: fallback.feedback, error: true
        });
      }
    }

    const totalWeight = questionsWithKey.reduce((s, q) => s + (q.weight ? Number(q.weight) : 1), 0);
    let totalScore = 0;
    for (const sr of scoreResults) {
      const q = questionMap.get(sr.question_id);
      const w = q && q.weight ? Number(q.weight) : 1;
      totalScore += (sr.final_score || 0) * (w / totalWeight);
    }
    totalScore = Math.round(totalScore * 100) / 100;

    const attemptToken = encodeAttemptToken(user_id, quiz_id, submitTimestamp);

    res.status(201).json({
      status: "success",
      message: "Jawaban berhasil dikumpulkan dan dinilai oleh AI!",
      data: {
        attempt_token: attemptToken,
        quiz_id: parseInt(quiz_id),
        user_id: parseInt(user_id),
        submitted_at: new Date(submitTimestamp).toISOString(),
        time_taken: time_taken || 0,
        answers: submittedAnswers,
        scores: scoreResults,
        total_score: totalScore,
        max_score: 100
      }
    });
  } catch (error) {
    console.error("❌ Error submitAnswers:", error);
    res.status(500).json({ message: "Gagal menyimpan jawaban", error: error.message });
  }
};

// ==========================================
// 7. GET HASIL ATTEMPT (detail)
// ==========================================
const getAttemptResult = async (req, res) => {
  try {
    const { attempt_token } = req.params;
    const decoded = decodeAttemptToken(attempt_token);

    if (!decoded || !decoded.userId || !decoded.quizId || !decoded.timestamp) {
      return res.status(400).json({ message: "Token attempt tidak valid." });
    }

    const { userId, quizId, timestamp } = decoded;

    const [quiz, student] = await Promise.all([
      prisma.quiz.findUnique({
        where: { quiz_id: quizId },
        include: {
          teacher: { select: { name: true } },
          subject: { select: { subject_name: true } },
          questions: {
            include: { answerKey: true },
            orderBy: { question_id: 'asc' }
          }
        }
      }),
      prisma.user.findUnique({
        where: { user_id: userId },
        select: { user_id: true, name: true }
      })
    ]);

    if (!quiz) return res.status(404).json({ message: "Kuis tidak ditemukan." });
    if (!student) return res.status(404).json({ message: "Siswa tidak ditemukan." });

    const windowStart = new Date(timestamp - 10_000);
    const windowEnd = new Date(timestamp + 10_000 + 5 * 60_000);

    const questionIds = quiz.questions.map(q => q.question_id);

    const studentAnswers = await prisma.studentAnswer.findMany({
      where: {
        user_id: userId,
        question_id: { in: questionIds },
        submission_date: { gte: windowStart, lte: windowEnd }
      },
      include: { score: true },
      orderBy: { submission_date: 'asc' }
    });

    if (studentAnswers.length === 0) {
      return res.status(404).json({
        message: "Data attempt tidak ditemukan. Mungkin sudah lewat atau token kadaluwarsa."
      });
    }

    const answerByQuestion = new Map();
    for (const a of studentAnswers) {
      const existing = answerByQuestion.get(a.question_id);
      if (!existing) {
        answerByQuestion.set(a.question_id, a);
      } else {
        const distOld = Math.abs(existing.submission_date.getTime() - timestamp);
        const distNew = Math.abs(a.submission_date.getTime() - timestamp);
        if (distNew < distOld) answerByQuestion.set(a.question_id, a);
      }
    }

    const totalWeight = quiz.questions.reduce((s, q) => s + (q.weight ? Number(q.weight) : 1), 0);
    let totalScore = 0;
    const answersPayload = quiz.questions.map((q) => {
      const a = answerByQuestion.get(q.question_id);
      const finalScore = a?.score?.final_score ? Number(a.score.final_score) : 0;
      const aiScore = a?.score?.ai_score ? Number(a.score.ai_score) : 0;
      const weight = q.weight ? Number(q.weight) : 1;
      totalScore += finalScore * (weight / totalWeight);

      return {
        question_id: q.question_id,
        question_text: q.question_text,
        weight,
        answer_key: q.answerKey?.key_text || null,
        answer_id: a?.answer_id || null,
        answer_text: a?.answer_text || "",
        ai_score: aiScore,
        final_score: finalScore,
        feedback: a?.score?.feedback || null,
        is_correct: finalScore >= 60
      };
    });

    totalScore = Math.round(totalScore * 100) / 100;
    const earliestSubmission = studentAnswers[0].submission_date;

    res.status(200).json({
      status: "success",
      data: {
        attempt_token,
        quiz: {
          quiz_id: quiz.quiz_id,
          title: quiz.title,
          description: quiz.description,
          subject: quiz.subject?.subject_name || "",
          teacher_name: quiz.teacher?.name || ""
        },
        student: { user_id: student.user_id, name: student.name },
        completed_at: earliestSubmission.toISOString(),
        answers: answersPayload,
        total_score: totalScore,
        max_score: 100
      }
    });
  } catch (error) {
    console.error("❌ Error getAttemptResult:", error);
    res.status(500).json({ message: "Gagal memuat hasil", error: error.message });
  }
};

// ==========================================
// 8. LIST ATTEMPTS MILIK SISWA (untuk halaman /student/results)
// Endpoint: GET /api/exams/student/:student_id/attempts
// ==========================================
const getStudentAttempts = async (req, res) => {
  try {
    const { student_id } = req.params;
    const studentId = parseInt(student_id);

    if (!studentId) return res.status(400).json({ message: "ID siswa tidak valid." });

    const allAnswers = await prisma.studentAnswer.findMany({
      where: { user_id: studentId },
      include: {
        question: {
          select: {
            quiz_id: true,
            weight: true,
            quiz: {
              select: {
                quiz_id: true,
                title: true,
                subject: { select: { subject_name: true } },
                grade: { select: { grade_name: true } }
              }
            }
          }
        },
        score: true
      },
      orderBy: { submission_date: 'desc' }
    });

    if (allAnswers.length === 0) {
      return res.status(200).json({ status: "success", data: [] });
    }

    // Group menjadi attempts
    const groups = groupAnswersIntoAttempts(allAnswers);

    // Convert tiap group jadi attempt summary
    const attempts = groups.map(group => {
      const first = group[0];
      const quiz = first.question.quiz;
      const totalWeight = group.reduce(
        (s, a) => s + (a.question.weight ? Number(a.question.weight) : 1), 0
      );
      let totalScore = 0;
      for (const a of group) {
        const w = a.question.weight ? Number(a.question.weight) : 1;
        const fs = a.score?.final_score ? Number(a.score.final_score) : 0;
        totalScore += fs * (w / totalWeight);
      }

      const earliest = group.reduce(
        (min, a) => a.submission_date < min ? a.submission_date : min,
        group[0].submission_date
      );

      const attemptToken = encodeAttemptToken(
        studentId, quiz.quiz_id, earliest.getTime()
      );

      return {
        attempt_token: attemptToken,
        quiz_id: quiz.quiz_id,
        quiz_title: quiz.title,
        subject_name: quiz.subject?.subject_name || "",
        grade_name: quiz.grade?.grade_name || "",
        answer_count: group.length,
        total_score: Math.round(totalScore * 100) / 100,
        max_score: 100,
        completed_at: earliest.toISOString()
      };
    });

    // Sort terbaru dulu
    attempts.sort((a, b) => b.completed_at.localeCompare(a.completed_at));

    res.status(200).json({ status: "success", data: attempts });
  } catch (error) {
    console.error("❌ Error getStudentAttempts:", error);
    res.status(500).json({ message: "Gagal mengambil daftar hasil", error: error.message });
  }
};

// ==========================================
// 9. LIST ATTEMPTS UNTUK GURU (semua siswa di quiz miliknya)
// Endpoint: GET /api/exams/teacher/:teacher_id/attempts
// ==========================================
const getTeacherAttempts = async (req, res) => {
  try {
    const { teacher_id } = req.params;
    const teacherId = parseInt(teacher_id);

    if (!teacherId) return res.status(400).json({ message: "ID guru tidak valid." });

    // Ambil semua quiz milik guru ini
    const myQuizzes = await prisma.quiz.findMany({
      where: { created_by: teacherId },
      select: { quiz_id: true, title: true,
        subject: { select: { subject_name: true } },
        grade: { select: { grade_name: true } }
      }
    });
    const myQuizIds = myQuizzes.map(q => q.quiz_id);

    if (myQuizIds.length === 0) {
      return res.status(200).json({ status: "success", data: [] });
    }

    // Ambil semua jawaban dari semua siswa untuk quiz-quiz tersebut
    const allAnswers = await prisma.studentAnswer.findMany({
      where: { question: { quiz_id: { in: myQuizIds } } },
      include: {
        question: {
          select: {
            quiz_id: true,
            weight: true,
            quiz: {
              select: {
                quiz_id: true, title: true,
                subject: { select: { subject_name: true } },
                grade: { select: { grade_name: true } }
              }
            }
          }
        },
        student: {
          select: {
            user_id: true,
            name: true,
            userDetail: { select: { grade: { select: { grade_name: true } } } }
          }
        },
        score: true
      },
      orderBy: { submission_date: 'desc' }
    });

    if (allAnswers.length === 0) {
      return res.status(200).json({ status: "success", data: [] });
    }

    const groups = groupAnswersIntoAttempts(allAnswers);

    const attempts = groups.map(group => {
      const first = group[0];
      const quiz = first.question.quiz;
      const student = first.student;
      const totalWeight = group.reduce(
        (s, a) => s + (a.question.weight ? Number(a.question.weight) : 1), 0
      );
      let totalScore = 0;
      for (const a of group) {
        const w = a.question.weight ? Number(a.question.weight) : 1;
        const fs = a.score?.final_score ? Number(a.score.final_score) : 0;
        totalScore += fs * (w / totalWeight);
      }

      const earliest = group.reduce(
        (min, a) => a.submission_date < min ? a.submission_date : min,
        group[0].submission_date
      );

      const attemptToken = encodeAttemptToken(
        student.user_id, quiz.quiz_id, earliest.getTime()
      );

      return {
        attempt_token: attemptToken,
        quiz_id: quiz.quiz_id,
        quiz_title: quiz.title,
        subject_name: quiz.subject?.subject_name || "",
        grade_name: quiz.grade?.grade_name || "",
        student_id: student.user_id,
        student_name: student.name,
        student_class: student.userDetail?.grade?.grade_name || "",
        answer_count: group.length,
        total_score: Math.round(totalScore * 100) / 100,
        max_score: 100,
        completed_at: earliest.toISOString()
      };
    });

    attempts.sort((a, b) => b.completed_at.localeCompare(a.completed_at));

    res.status(200).json({
      status: "success",
      data: attempts,
      quizzes: myQuizzes
    });
  } catch (error) {
    console.error("❌ Error getTeacherAttempts:", error);
    res.status(500).json({ message: "Gagal mengambil daftar hasil", error: error.message });
  }
};

module.exports = {
  createQuizWithQuestions,
  addQuestionWithKey,
  getTeacherQuizzes,
  getAvailableQuizzes,
  getQuizQuestions,
  submitAnswers,
  getAttemptResult,
  getStudentAttempts,
  getTeacherAttempts
};
