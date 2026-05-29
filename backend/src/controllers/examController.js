const prisma = require('../config/prismaClient');
const { gradeEssayWithAI } = require('../services/aiService');
const ensureOwn = (req, paramName) => {
  const paramId = parseInt(req.params[paramName]);
  if (!paramId || req.user.userId !== paramId) {
    return { ok: false, status: 403, message: "Anda hanya boleh mengakses data sendiri." };
  }
  return { ok: true, userId: paramId };
};
// ==========================================
// HELPER token
// ==========================================
const encodeAttemptToken = (userId, quizId, timestamp) => {
  const raw = `${userId}:${quizId}:${timestamp}`;
  return Buffer.from(raw, 'utf8').toString('base64url');
};

const decodeAttemptToken = (token) => {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const [userId, quizId, timestamp] = raw.split(':');
    return { userId: parseInt(userId), quizId: parseInt(quizId), timestamp: parseInt(timestamp) };
  } catch (e) {
    return null;
  }
};

const groupAnswersIntoAttempts = (answers) => {
  if (answers.length === 0) return [];
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
    const sameAttempt = sameUser && sameQuiz && timeDiff < 60_000;
    if (sameAttempt) currentGroup.push(curr);
    else { attempts.push(currentGroup); currentGroup = [curr]; }
  }
  attempts.push(currentGroup);
  return attempts;
};

// ==========================================
// 1. CREATE QUIZ
// ==========================================
const createQuizWithQuestions = async (req, res) => {
  try {
const { title, description, subject_id, timeLimit, grade_id, dueDate, questions } = req.body;
const created_by = req.user.userId;
    const result = await prisma.$transaction(async (tx) => {
      const quiz = await tx.quiz.create({
        data: {
          title, description,
          subject_id: parseInt(subject_id),
          time_limit: parseInt(timeLimit),
          grade_id: parseInt(grade_id),
          due_date: new Date(dueDate),
          created_by: parseInt(created_by)
        }
      });
      for (const q of questions) {
        const newQuestion = await tx.essayQuestion.create({
          data: { quiz_id: quiz.quiz_id, question_text: q.text, weight: q.points }
        });
        await tx.answerKey.create({
          data: { question_id: newQuestion.question_id, key_text: q.correctAnswer }
        });
      }
      return quiz;
    });
    res.status(201).json({ status: "success", message: "Kuis berhasil dibuat!", data: result });
  } catch (error) {
    console.error("❌ Error createQuizWithQuestions:", error);
    res.status(500).json({ message: "Gagal membuat kuis", error: error.message });
  }
};

// ==========================================
// 2. ADD QUESTION
// ==========================================
const addQuestionWithKey = async (req, res) => {
  try {
    const { quiz_id, question_text, weight, key_text } = req.body;

    const quiz = await prisma.quiz.findUnique({ where: { quiz_id: parseInt(quiz_id) } });
    if (!quiz) return res.status(404).json({ message: "Kuis tidak ditemukan." });
    if (quiz.created_by !== req.user.userId) {
      return res.status(403).json({ message: "Anda bukan pemilik kuis ini." });
    }

    const result = await prisma.$transaction(async (tx) => {
      const newQuestion = await tx.essayQuestion.create({
        data: { quiz_id, question_text, weight: weight || 1.00 }
      });
      const newAnswerKey = await tx.answerKey.create({
        data: { question_id: newQuestion.question_id, key_text }
      });
      return { question: newQuestion, answerKey: newAnswerKey };
    });
    res.status(201).json({ message: "Soal & Kunci ditambahkan!", data: result });
  } catch (error) {
    console.error("❌ Error addQuestionWithKey:", error);
    res.status(500).json({ message: "Gagal menambahkan soal", error: error.message });
  }
};

// ==========================================
// 3. TEACHER QUIZZES
// ==========================================
const getTeacherQuizzes = async (req, res) => {
  try {
    const check = ensureOwn(req, 'teacher_id');
    if (!check.ok) return res.status(check.status).json({ message: check.message });

    const quizzes = await prisma.quiz.findMany({
      where: { created_by: check.userId },
      include: {
        _count: { select: { questions: true } },
        grade: { select: { grade_name: true, school_level: true } },
        subject: { select: { subject_id: true, subject_name: true } }
      },
      orderBy: { created_at: 'desc' }
    });
    res.status(200).json({ message: "Berhasil", data: quizzes });
  } catch (error) {
    console.error("❌ Error getTeacherQuizzes:", error);
    res.status(500).json({ message: "Gagal mengambil kuis", error: error.message });
  }
};

// ==========================================
// 4. AVAILABLE QUIZZES (siswa, by school_level)
// ==========================================
const getAvailableQuizzes = async (req, res) => {
  try {
    const check = ensureOwn(req, 'student_id');
    if (!check.ok) return res.status(check.status).json({ message: check.message });
    const studentId = check.userId;

    const studentDetail = await prisma.userDetail.findUnique({
      where: { user_id: studentId },
      include: { grade: true }
    });
    if (!studentDetail) return res.status(404).json({ message: "Data siswa tidak ditemukan." });
    if (!studentDetail.grade_id || !studentDetail.grade) {
      return res.status(200).json({ status: "success", data: [], message: "Siswa belum punya kelas." });
    }

    const schoolLevel = studentDetail.grade.school_level;
    const gradesInSameLevel = await prisma.grade.findMany({
      where: { school_level: schoolLevel },
      select: { grade_id: true }
    });
    const gradeIds = gradesInSameLevel.map(g => g.grade_id);

    const quizzes = await prisma.quiz.findMany({
      where: { grade_id: { in: gradeIds } },
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
        where: { user_id: studentId, question: { quiz_id: { in: quizIds } } },
        select: { question: { select: { quiz_id: true } } }
      });
      for (const a of answers) completedQuizIds.add(a.question.quiz_id);
    }

    const enriched = quizzes.map(q => ({ ...q, is_completed: completedQuizIds.has(q.quiz_id) }));
    res.status(200).json({
      status: "success", data: enriched,
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
// 5. QUIZ QUESTIONS (siswa buka kuis)
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
// 6. SUBMIT ANSWERS + AI GRADING
// (Score dibuat dengan is_approved = false by default)
// ==========================================
const submitAnswers = async (req, res) => {
  try {
    const { quiz_id } = req.params;
const { answers, time_taken } = req.body;
const user_id = req.user.userId;
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
            feedback: "Kunci jawaban tidak ditemukan, perlu dinilai manual.",
            is_approved: false
          }
        });
        scoreResults.push({ answer_id: ans.answer_id, question_id: ans.question_id, error: true });
        continue;
      }
      try {
        const aiResult = await gradeEssayWithAI(q.question_text, q.answerKey.key_text, ans.answer_text);
        await prisma.score.create({
          data: {
            answer_id: ans.answer_id,
            ai_score: aiResult.skor,
            final_score: aiResult.nilai_100,
            feedback: aiResult.alasan,
            is_approved: false   // ← WAJIB false, guru harus approve dulu
          }
        });
        scoreResults.push({ answer_id: ans.answer_id, question_id: ans.question_id, error: false });
      } catch (aiError) {
        console.error(`❌ AI gagal answer_id ${ans.answer_id}:`, aiError.message);
        await prisma.score.create({
          data: {
            answer_id: ans.answer_id, ai_score: 0, final_score: 0,
            feedback: `AI gagal menilai: ${aiError.message}. Mohon dinilai manual oleh guru.`,
            is_approved: false
          }
        });
        scoreResults.push({ answer_id: ans.answer_id, question_id: ans.question_id, error: true });
      }
    }

    const attemptToken = encodeAttemptToken(user_id, quiz_id, submitTimestamp);
    res.status(201).json({
      status: "success",
      message: "Jawaban berhasil dikumpulkan! Menunggu koreksi guru.",
      data: {
        attempt_token: attemptToken,
        quiz_id: parseInt(quiz_id),
        user_id: parseInt(user_id),
        submitted_at: new Date(submitTimestamp).toISOString(),
        time_taken: time_taken || 0,
        is_approved: false
      }
    });
  } catch (error) {
    console.error("❌ Error submitAnswers:", error);
    res.status(500).json({ message: "Gagal menyimpan jawaban", error: error.message });
  }
};

// ==========================================
// 7. GET ATTEMPT RESULT
// Query param ?viewer=teacher|student
//   - teacher: lihat semua data + status approval
//   - student: kalau belum semua approved → sembunyikan nilai
// ==========================================
const getAttemptResult = async (req, res) => {
  try {
    const { attempt_token } = req.params;
    const decoded = decodeAttemptToken(attempt_token);
    if (!decoded || !decoded.userId || !decoded.quizId || !decoded.timestamp) {
      return res.status(400).json({ message: "Token attempt tidak valid." });
    }
    const { userId, quizId, timestamp } = decoded;

    const isTeacherViewer = req.user.roleId === 2;
    const isStudentViewer = req.user.roleId === 3;

    if (isStudentViewer) {
      if (req.user.userId !== userId) {
        return res.status(403).json({ message: "Bukan attempt Anda." });
      }
    } else if (isTeacherViewer) {
      const owner = await prisma.quiz.findUnique({
        where: { quiz_id: quizId }, select: { created_by: true }
      });
      if (!owner) return res.status(404).json({ message: "Kuis tidak ditemukan." });
      if (owner.created_by !== req.user.userId) {
        return res.status(403).json({ message: "Anda bukan pemilik kuis ini." });
      }
    } else {
      return res.status(403).json({ message: "Role tidak diizinkan." });
    }

    const viewer = isTeacherViewer ? "teacher" : "student";

    const [quiz, student] = await Promise.all([
      prisma.quiz.findUnique({
        where: { quiz_id: quizId },
        include: {
          teacher: { select: { name: true } },
          subject: { select: { subject_name: true } },
          questions: { include: { answerKey: true }, orderBy: { question_id: 'asc' } }
        }
      }),
      prisma.user.findUnique({ where: { user_id: userId }, select: { user_id: true, name: true } })
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
      return res.status(404).json({ message: "Data attempt tidak ditemukan." });
    }

    const answerByQuestion = new Map();
    for (const a of studentAnswers) {
      const existing = answerByQuestion.get(a.question_id);
      if (!existing) answerByQuestion.set(a.question_id, a);
      else {
        const distOld = Math.abs(existing.submission_date.getTime() - timestamp);
        const distNew = Math.abs(a.submission_date.getTime() - timestamp);
        if (distNew < distOld) answerByQuestion.set(a.question_id, a);
      }
    }

    // Hitung status approval keseluruhan
    const allScores = quiz.questions
      .map(q => answerByQuestion.get(q.question_id)?.score)
      .filter(Boolean);
    const totalScored = allScores.length;
    const approvedCount = allScores.filter(s => s.is_approved).length;
    const isFullyApproved = totalScored > 0 && approvedCount === totalScored;

    const totalWeight = quiz.questions.reduce((s, q) => s + (q.weight ? Number(q.weight) : 1), 0);
    let totalScore = 0;
    const answersPayload = quiz.questions.map((q) => {
      const a = answerByQuestion.get(q.question_id);
      const score = a?.score;
      const finalScore = score?.final_score ? Number(score.final_score) : 0;
      const aiScore = score?.ai_score ? Number(score.ai_score) : 0;
      const weight = q.weight ? Number(q.weight) : 1;
      const approved = !!score?.is_approved;
      totalScore += finalScore * (weight / totalWeight);

      // Untuk siswa: kalau belum fully approved, sembunyikan semua angka & feedback
      const hideForStudent = viewer === "student" && !isFullyApproved;

      return {
        question_id: q.question_id,
        question_text: q.question_text,
        weight,
        score_id: score?.score_id || null,
        answer_id: a?.answer_id || null,
        answer_text: a?.answer_text || "",
        answer_key: viewer === "teacher" ? (q.answerKey?.key_text || null) : null,
        ai_score: hideForStudent ? null : aiScore,
        final_score: hideForStudent ? null : finalScore,
        feedback: hideForStudent ? null : (score?.feedback || null),
        is_approved: approved,
        is_correct: hideForStudent ? null : (finalScore >= 60)
      };
    });

    totalScore = Math.round(totalScore * 100) / 100;
    const earliestSubmission = studentAnswers[0].submission_date;
    const hideTotal = viewer === "student" && !isFullyApproved;

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
        total_score: hideTotal ? null : totalScore,
        max_score: 100,
        // Status approval
        is_fully_approved: isFullyApproved,
        approved_count: approvedCount,
        total_questions: totalScored
      }
    });
  } catch (error) {
    console.error("❌ Error getAttemptResult:", error);
    res.status(500).json({ message: "Gagal memuat hasil", error: error.message });
  }
};

// ==========================================
// 8. STUDENT ATTEMPTS LIST (dengan status approval)
// ==========================================
const getStudentAttempts = async (req, res) => {
  try {
    const check = ensureOwn(req, 'student_id');
    if (!check.ok) return res.status(check.status).json({ message: check.message });
    const studentId = check.userId;

    const allAnswers = await prisma.studentAnswer.findMany({
      where: { user_id: studentId },
      include: {
        question: {
          select: {
            quiz_id: true, weight: true,
            quiz: {
              select: {
                quiz_id: true, title: true,
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
    if (allAnswers.length === 0) return res.status(200).json({ status: "success", data: [] });

    const groups = groupAnswersIntoAttempts(allAnswers);
    const attempts = groups.map(group => {
      const first = group[0];
      const quiz = first.question.quiz;
      const totalWeight = group.reduce((s, a) => s + (a.question.weight ? Number(a.question.weight) : 1), 0);
      let totalScore = 0;
      for (const a of group) {
        const w = a.question.weight ? Number(a.question.weight) : 1;
        const fs = a.score?.final_score ? Number(a.score.final_score) : 0;
        totalScore += fs * (w / totalWeight);
      }
      const earliest = group.reduce((min, a) => a.submission_date < min ? a.submission_date : min, group[0].submission_date);
      const attemptToken = encodeAttemptToken(studentId, quiz.quiz_id, earliest.getTime());

      // Status approval attempt
      const scores = group.map(a => a.score).filter(Boolean);
      const isFullyApproved = scores.length > 0 && scores.every(s => s.is_approved);

      return {
        attempt_token: attemptToken,
        quiz_id: quiz.quiz_id,
        quiz_title: quiz.title,
        subject_name: quiz.subject?.subject_name || "",
        grade_name: quiz.grade?.grade_name || "",
        answer_count: group.length,
        // Sembunyikan nilai kalau belum approved
        total_score: isFullyApproved ? Math.round(totalScore * 100) / 100 : null,
        max_score: 100,
        is_approved: isFullyApproved,
        completed_at: earliest.toISOString()
      };
    });

    attempts.sort((a, b) => b.completed_at.localeCompare(a.completed_at));
    res.status(200).json({ status: "success", data: attempts });
  } catch (error) {
    console.error("❌ Error getStudentAttempts:", error);
    res.status(500).json({ message: "Gagal mengambil daftar hasil", error: error.message });
  }
};

// ==========================================
// 9. TEACHER ATTEMPTS LIST (dengan status approval)
// ==========================================
const getTeacherAttempts = async (req, res) => {
  try {
    const check = ensureOwn(req, 'teacher_id');
    if (!check.ok) return res.status(check.status).json({ message: check.message });
    const teacherId = check.userId;

    const myQuizzes = await prisma.quiz.findMany({
      where: { created_by: teacherId },
      select: {
        quiz_id: true, title: true,
        subject: { select: { subject_name: true } },
        grade: { select: { grade_name: true } }
      }
    });
    const myQuizIds = myQuizzes.map(q => q.quiz_id);
    if (myQuizIds.length === 0) return res.status(200).json({ status: "success", data: [] });

    const allAnswers = await prisma.studentAnswer.findMany({
      where: { question: { quiz_id: { in: myQuizIds } } },
      include: {
        question: {
          select: {
            quiz_id: true, weight: true,
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
            user_id: true, name: true,
            userDetail: { select: { grade: { select: { grade_name: true } } } }
          }
        },
        score: true
      },
      orderBy: { submission_date: 'desc' }
    });
    if (allAnswers.length === 0) return res.status(200).json({ status: "success", data: [], quizzes: myQuizzes });

    const groups = groupAnswersIntoAttempts(allAnswers);
    const attempts = groups.map(group => {
      const first = group[0];
      const quiz = first.question.quiz;
      const studentObj = first.student;
      const totalWeight = group.reduce((s, a) => s + (a.question.weight ? Number(a.question.weight) : 1), 0);
      let totalScore = 0;
      for (const a of group) {
        const w = a.question.weight ? Number(a.question.weight) : 1;
        const fs = a.score?.final_score ? Number(a.score.final_score) : 0;
        totalScore += fs * (w / totalWeight);
      }
      const earliest = group.reduce((min, a) => a.submission_date < min ? a.submission_date : min, group[0].submission_date);
      const attemptToken = encodeAttemptToken(studentObj.user_id, quiz.quiz_id, earliest.getTime());

      const scores = group.map(a => a.score).filter(Boolean);
      const isFullyApproved = scores.length > 0 && scores.every(s => s.is_approved);

      return {
        attempt_token: attemptToken,
        quiz_id: quiz.quiz_id,
        quiz_title: quiz.title,
        subject_name: quiz.subject?.subject_name || "",
        grade_name: quiz.grade?.grade_name || "",
        student_id: studentObj.user_id,
        student_name: studentObj.name,
        student_class: studentObj.userDetail?.grade?.grade_name || "",
        answer_count: group.length,
        total_score: Math.round(totalScore * 100) / 100,  // guru selalu lihat nilai
        max_score: 100,
        is_approved: isFullyApproved,   // status koreksi
        completed_at: earliest.toISOString()
      };
    });

    attempts.sort((a, b) => b.completed_at.localeCompare(a.completed_at));
    res.status(200).json({ status: "success", data: attempts, quizzes: myQuizzes });
  } catch (error) {
    console.error("❌ Error getTeacherAttempts:", error);
    res.status(500).json({ message: "Gagal mengambil daftar hasil", error: error.message });
  }
};

// ==========================================
// 10. EDIT SCORE (guru ubah skor + feedback satu jawaban)
// Endpoint: PUT /api/exams/score/:score_id
// Body: { final_score?, feedback? }
// ==========================================
const updateScore = async (req, res) => {
  try {
    const { score_id } = req.params;
    const { final_score, feedback } = req.body;
    const scoreId = parseInt(score_id);
    if (!scoreId) return res.status(400).json({ message: "Score ID tidak valid." });

    const scoreCheck = await prisma.score.findUnique({
      where: { score_id: scoreId },
      include: { answer: { include: { question: { select: { quiz: { select: { created_by: true } } } } } } }
    });
    if (!scoreCheck) return res.status(404).json({ message: "Nilai tidak ditemukan." });
    if (scoreCheck.answer.question.quiz.created_by !== req.user.userId) {
      return res.status(403).json({ message: "Anda bukan pemilik kuis ini." });
    }

    const data = {};
    if (final_score !== undefined && final_score !== null) {
      const fs = Number(final_score);
      if (isNaN(fs) || fs < 0 || fs > 100) {
        return res.status(400).json({ message: "Nilai harus antara 0-100." });
      }
      data.final_score = fs;
    }
    if (feedback !== undefined) {
      data.feedback = feedback;
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "Tidak ada perubahan yang dikirim." });
    }

    const updated = await prisma.score.update({
      where: { score_id: scoreId },
      data
    });

    res.status(200).json({
      status: "success",
      message: "Nilai berhasil diperbarui.",
      data: {
        score_id: updated.score_id,
        final_score: updated.final_score ? Number(updated.final_score) : 0,
        feedback: updated.feedback,
        is_approved: updated.is_approved
      }
    });
  } catch (error) {
    console.error("❌ Error updateScore:", error);
    res.status(500).json({ message: "Gagal memperbarui nilai.", error: error.message });
  }
};

// ==========================================
// 11. APPROVE SATU SCORE
// Endpoint: PUT /api/exams/score/:score_id/approve
// ==========================================
const approveScore = async (req, res) => {
  try {
    const { score_id } = req.params;
    const scoreId = parseInt(score_id);
    if (!scoreId) return res.status(400).json({ message: "Score ID tidak valid." });

    const scoreCheck = await prisma.score.findUnique({
      where: { score_id: scoreId },
      include: { answer: { include: { question: { select: { quiz: { select: { created_by: true } } } } } } }
    });
    if (!scoreCheck) return res.status(404).json({ message: "Nilai tidak ditemukan." });
    if (scoreCheck.answer.question.quiz.created_by !== req.user.userId) {
      return res.status(403).json({ message: "Anda bukan pemilik kuis ini." });
    }

    const updated = await prisma.score.update({
      where: { score_id: scoreId },
      data: { is_approved: true, approved_at: new Date() }
    });

    res.status(200).json({
      status: "success",
      message: "Nilai disetujui.",
      data: { score_id: updated.score_id, is_approved: true }
    });
  } catch (error) {
    console.error("❌ Error approveScore:", error);
    res.status(500).json({ message: "Gagal menyetujui nilai.", error: error.message });
  }
};

// ==========================================
// 12. APPROVE SEMUA SCORE DALAM SATU ATTEMPT
// Endpoint: PUT /api/exams/attempt/:attempt_token/approve-all
// ==========================================
const approveAllInAttempt = async (req, res) => {
  try {
    const { attempt_token } = req.params;
    const decoded = decodeAttemptToken(attempt_token);
if (!decoded) return res.status(400).json({ message: "Token tidak valid." });
const { userId, quizId, timestamp } = decoded;

const quizOwner = await prisma.quiz.findUnique({
  where: { quiz_id: quizId }, select: { created_by: true }
});
if (!quizOwner) return res.status(404).json({ message: "Kuis tidak ditemukan." });
if (quizOwner.created_by !== req.user.userId) {
  return res.status(403).json({ message: "Anda bukan pemilik kuis ini." });
}

const questions = await prisma.essayQuestion.findMany({
      where: { quiz_id: quizId },
      select: { question_id: true }
    });
    const questionIds = questions.map(q => q.question_id);

    const windowStart = new Date(timestamp - 10_000);
    const windowEnd = new Date(timestamp + 10_000 + 5 * 60_000);

    // Ambil jawaban siswa dalam window ini
    const studentAnswers = await prisma.studentAnswer.findMany({
      where: {
        user_id: userId,
        question_id: { in: questionIds },
        submission_date: { gte: windowStart, lte: windowEnd }
      },
      include: { score: true }
    });

    const scoreIds = studentAnswers
      .map(a => a.score?.score_id)
      .filter(Boolean);

    if (scoreIds.length === 0) {
      return res.status(404).json({ message: "Tidak ada nilai untuk disetujui." });
    }

    await prisma.score.updateMany({
      where: { score_id: { in: scoreIds } },
      data: { is_approved: true, approved_at: new Date() }
    });

    res.status(200).json({
      status: "success",
      message: `${scoreIds.length} nilai berhasil disetujui.`,
      approved_count: scoreIds.length
    });
  } catch (error) {
    console.error("❌ Error approveAllInAttempt:", error);
    res.status(500).json({ message: "Gagal menyetujui semua nilai.", error: error.message });
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
  getTeacherAttempts,
  updateScore,
  approveScore,
  approveAllInAttempt
};