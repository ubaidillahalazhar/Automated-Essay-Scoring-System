const prisma = require('../config/prismaClient');
const { AppError } = require('../middleware/errorHandler');
const { groupAnswersIntoAttempts } = require('./examController');

/* ─── Konstanta ──────────────────────────────────────────────────────────── */

const STUDENT_ROLE_ID = 3;

const ALLOWED_EVENTS = new Set([
  'quiz_started',
  'quiz_resumed',
  'time_warning_shown',
  'tab_hidden',
  'tab_visible',
  'submitted',
  'auto_submitted'
]);

const START_EVENTS = new Set(['quiz_started', 'quiz_resumed']);
const END_EVENTS = new Set(['submitted', 'auto_submitted']);

/* ─── Helper ─────────────────────────────────────────────────────────────── */

const ensureOwnTeacher = (req) => {
  const paramId = parseInt(req.params.teacher_id);
  if (!paramId || req.user.userId !== paramId) {
    throw new AppError('Anda hanya boleh mengakses data sendiri.', 403);
  }
  return paramId;
};

const round2 = (n) => Math.round(n * 100) / 100;

/* ==========================================================================
 * 1. SISWA: catat satu event aktivitas
 * POST /api/exams/:quiz_id/activity
 * ========================================================================== */
const logQuizActivity = async (req, res) => {
  const quizId = parseInt(req.params.quiz_id);
  const { event_type, metadata } = req.body;

  if (!quizId) throw new AppError('Kuis tidak valid.', 400);
  if (!ALLOWED_EVENTS.has(event_type)) throw new AppError('Jenis aktivitas tidak dikenali.', 400);

  const quizExists = await prisma.quiz.findUnique({
    where: { quiz_id: quizId },
    select: { quiz_id: true }
  });
  if (!quizExists) throw new AppError('Kuis tidak ditemukan.', 404);

  await prisma.quizActivityLog.create({
    data: {
      user_id: req.user.userId,
      quiz_id: quizId,
      event_type,
      // Batasi ukuran metadata supaya log tidak bisa dipakai menitipkan data besar.
      metadata: metadata && typeof metadata === 'object'
        ? JSON.parse(JSON.stringify(metadata).slice(0, 2000))
        : null
    }
  });

  res.status(201).json({ status: 'success' });
};

/* ==========================================================================
 * 2. GURU: laporan aktivitas siswa
 * GET /api/exams/teacher/:teacher_id/activity?quiz_id=&days=
 * ========================================================================== */
const getActivityReport = async (req, res) => {
  const teacherId = ensureOwnTeacher(req);

  const quizFilter = req.query.quiz_id ? parseInt(req.query.quiz_id) : null;
  const days = Math.min(parseInt(req.query.days) || 30, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  /* ── a. Kuis milik guru ini ── */
  const myQuizzes = await prisma.quiz.findMany({
    where: {
      created_by: teacherId,
      ...(quizFilter ? { quiz_id: quizFilter } : {})
    },
    select: {
      quiz_id: true, title: true, time_limit: true, due_date: true, grade_id: true,
      subject: { select: { subject_name: true } },
      grade: { select: { grade_name: true } },
      _count: { select: { questions: true } }
    },
    orderBy: { created_at: 'desc' }
  });

  const quizIds = myQuizzes.map((q) => q.quiz_id);
  const emptyPayload = {
    summary: {
      total_students: 0, active_now: 0, submissions: 0, completion_rate: 0,
      average_score: 0, pending_review: 0, auto_submitted: 0, never_logged_in: 0
    },
    live: [], students: [], quizzes: [], events: []
  };

  if (quizIds.length === 0) {
    return res.status(200).json({ status: 'success', data: emptyPayload, quiz_options: [] });
  }

  const quizById = new Map(myQuizzes.map((q) => [q.quiz_id, q]));
  const gradeIds = [...new Set(myQuizzes.map((q) => q.grade_id).filter(Boolean))];

  /* ── b. Siswa yang menjadi sasaran kuis (berdasarkan tingkat kelas) ── */
  const studentDetails = await prisma.userDetail.findMany({
    where: {
      grade_id: { in: gradeIds },
      user: { role_id: STUDENT_ROLE_ID }
    },
    select: {
      user_id: true, grade_id: true, last_login: true,
      grade: { select: { grade_name: true } },
      user: { select: { name: true } }
    }
  });

  /* ── c. Jawaban → attempt ── */
  const answers = await prisma.studentAnswer.findMany({
    where: { question: { quiz_id: { in: quizIds } } },
    include: {
      question: { select: { quiz_id: true, weight: true } },
      student: { select: { user_id: true, name: true } },
      score: { select: { final_score: true, is_approved: true } }
    },
    orderBy: { submission_date: 'desc' }
  });

  const attempts = groupAnswersIntoAttempts(answers).map((group) => {
    const first = group[0];
    const totalWeight = group.reduce((sum, a) => sum + (a.question.weight ? Number(a.question.weight) : 1), 0);
    const totalScore = group.reduce((sum, a) => {
      const weight = a.question.weight ? Number(a.question.weight) : 1;
      const score = a.score?.final_score ? Number(a.score.final_score) : 0;
      return sum + score * (weight / (totalWeight || 1));
    }, 0);

    const submittedAt = group.reduce(
      (min, a) => (a.submission_date < min ? a.submission_date : min),
      first.submission_date
    );

    return {
      quiz_id: first.question.quiz_id,
      student_id: first.student.user_id,
      student_name: first.student.name,
      score: round2(totalScore),
      submitted_at: submittedAt,
      pending_review: group.some((a) => a.score && !a.score.is_approved)
    };
  });

  /* ── d. Log aktivitas ── */
  const logs = await prisma.quizActivityLog.findMany({
    where: { quiz_id: { in: quizIds }, created_at: { gte: since } },
    include: { student: { select: { user_id: true, name: true } } },
    orderBy: { created_at: 'desc' },
    take: 3000
  });

  /* ── e. Sesi yang sedang berjalan ── */
  // Sebuah sesi dianggap masih berjalan bila ada event mulai yang belum diikuti
  // event pengumpulan, dan batas waktunya belum lewat.
  const now = Date.now();
  const latestByStudentQuiz = new Map();
  for (const log of [...logs].reverse()) {   // urut lama → baru
    const key = `${log.user_id}:${log.quiz_id}`;
    const entry = latestByStudentQuiz.get(key) || { start: null, ended: false, tabHidden: 0, last: log.created_at };
    if (START_EVENTS.has(log.event_type)) { entry.start = log.created_at; entry.ended = false; }
    if (END_EVENTS.has(log.event_type)) entry.ended = true;
    if (log.event_type === 'tab_hidden') entry.tabHidden += 1;
    entry.last = log.created_at;
    latestByStudentQuiz.set(key, entry);
  }

  const submittedPairs = new Set(attempts.map((a) => `${a.student_id}:${a.quiz_id}`));

  const live = [];
  for (const [key, entry] of latestByStudentQuiz) {
    if (!entry.start || entry.ended) continue;
    if (submittedPairs.has(key)) continue;

    const [userIdRaw, quizIdRaw] = key.split(':');
    const quiz = quizById.get(parseInt(quizIdRaw));
    if (!quiz) continue;

    const limitMs = (quiz.time_limit || 30) * 60 * 1000;
    const elapsed = now - entry.start.getTime();
    if (elapsed > limitMs + 5 * 60 * 1000) continue;   // sesi basi

    const student = studentDetails.find((s) => s.user_id === parseInt(userIdRaw));
    live.push({
      student_id: parseInt(userIdRaw),
      student_name: student?.user?.name || 'Siswa',
      class_name: student?.grade?.grade_name || '',
      quiz_id: quiz.quiz_id,
      quiz_title: quiz.title,
      started_at: entry.start.toISOString(),
      last_seen: entry.last.toISOString(),
      elapsed_seconds: Math.floor(elapsed / 1000),
      remaining_seconds: Math.max(0, Math.floor((limitMs - elapsed) / 1000)),
      tab_switches: entry.tabHidden
    });
  }
  live.sort((a, b) => a.remaining_seconds - b.remaining_seconds);

  /* ── f. Rekap per siswa ── */
  const students = studentDetails.map((detail) => {
    const assignedQuizzes = myQuizzes.filter((q) => q.grade_id === detail.grade_id);
    const myAttempts = attempts.filter((a) => a.student_id === detail.user_id);
    const myLogs = logs.filter((l) => l.user_id === detail.user_id);

    const scores = myAttempts.map((a) => a.score);
    const lastAttempt = myAttempts.reduce(
      (max, a) => (!max || a.submitted_at > max ? a.submitted_at : max),
      null
    );
    const lastLog = myLogs[0]?.created_at || null;
    const lastActivity = [lastAttempt, lastLog, detail.last_login]
      .filter(Boolean)
      .sort((a, b) => b - a)[0] || null;

    const overdueUndone = assignedQuizzes.filter(
      (q) => new Date(q.due_date) < new Date() && !myAttempts.some((a) => a.quiz_id === q.quiz_id)
    ).length;

    let status = 'aktif';
    if (!detail.last_login) status = 'belum pernah masuk';
    else if (assignedQuizzes.length > 0 && myAttempts.length === 0) status = 'belum mengerjakan';
    else if (overdueUndone > 0) status = 'ada tugas terlewat';

    return {
      student_id: detail.user_id,
      student_name: detail.user?.name || 'Siswa',
      class_name: detail.grade?.grade_name || '',
      assigned_count: assignedQuizzes.length,
      completed_count: myAttempts.length,
      overdue_count: overdueUndone,
      average_score: scores.length ? round2(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      tab_switches: myLogs.filter((l) => l.event_type === 'tab_hidden').length,
      auto_submitted: myLogs.filter((l) => l.event_type === 'auto_submitted').length,
      pending_review: myAttempts.filter((a) => a.pending_review).length,
      last_login: detail.last_login ? detail.last_login.toISOString() : null,
      last_activity: lastActivity ? new Date(lastActivity).toISOString() : null,
      status
    };
  });

  students.sort((a, b) => {
    const rank = (s) => (s.status === 'belum pernah masuk' ? 0 : s.status === 'belum mengerjakan' ? 1 : s.status === 'ada tugas terlewat' ? 2 : 3);
    return rank(a) - rank(b) || a.student_name.localeCompare(b.student_name);
  });

  /* ── g. Rekap per kuis ── */
  const quizzes = myQuizzes.map((quiz) => {
    const targetCount = studentDetails.filter((s) => s.grade_id === quiz.grade_id).length;
    const quizAttempts = attempts.filter((a) => a.quiz_id === quiz.quiz_id);
    const quizLogs = logs.filter((l) => l.quiz_id === quiz.quiz_id);
    const scores = quizAttempts.map((a) => a.score);

    // Durasi pengerjaan: dari event mulai sampai event kumpul.
    const durations = [];
    const startByUser = new Map();
    for (const log of [...quizLogs].reverse()) {
      if (START_EVENTS.has(log.event_type)) startByUser.set(log.user_id, log.created_at);
      if (END_EVENTS.has(log.event_type)) {
        const start = startByUser.get(log.user_id);
        if (start) {
          durations.push((log.created_at.getTime() - start.getTime()) / 1000);
          startByUser.delete(log.user_id);
        }
      }
    }

    return {
      quiz_id: quiz.quiz_id,
      title: quiz.title,
      subject_name: quiz.subject?.subject_name || '',
      grade_name: quiz.grade?.grade_name || '',
      question_count: quiz._count.questions,
      time_limit: quiz.time_limit,
      due_date: quiz.due_date.toISOString(),
      is_overdue: new Date(quiz.due_date) < new Date(),
      target_students: targetCount,
      submitted_count: quizAttempts.length,
      not_started_count: Math.max(0, targetCount - quizAttempts.length),
      participation_rate: targetCount ? round2((quizAttempts.length / targetCount) * 100) : 0,
      average_score: scores.length ? round2(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      pending_review: quizAttempts.filter((a) => a.pending_review).length,
      auto_submitted: quizLogs.filter((l) => l.event_type === 'auto_submitted').length,
      average_duration_seconds: durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null
    };
  });

  /* ── h. Event terbaru (linimasa) ── */
  const events = logs.slice(0, 100).map((log) => ({
    log_id: log.log_id,
    created_at: log.created_at.toISOString(),
    student_id: log.user_id,
    student_name: log.student?.name || 'Siswa',
    quiz_id: log.quiz_id,
    quiz_title: quizById.get(log.quiz_id)?.title || '',
    event_type: log.event_type,
    metadata: log.metadata || null
  }));

  /* ── i. Ringkasan ── */
  const allScores = attempts.map((a) => a.score);
  const totalAssignments = students.reduce((sum, s) => sum + s.assigned_count, 0);
  const totalCompleted = students.reduce((sum, s) => sum + s.completed_count, 0);

  const summary = {
    total_students: students.length,
    active_now: live.length,
    submissions: attempts.length,
    completion_rate: totalAssignments ? round2((totalCompleted / totalAssignments) * 100) : 0,
    average_score: allScores.length ? round2(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0,
    pending_review: attempts.filter((a) => a.pending_review).length,
    auto_submitted: logs.filter((l) => l.event_type === 'auto_submitted').length,
    never_logged_in: students.filter((s) => s.status === 'belum pernah masuk').length
  };

  res.status(200).json({
    status: 'success',
    data: { summary, live, students, quizzes, events },
    quiz_options: myQuizzes.map((q) => ({
      quiz_id: q.quiz_id,
      title: q.title,
      grade_name: q.grade?.grade_name || ''
    }))
  });
};

module.exports = { logQuizActivity, getActivityReport };