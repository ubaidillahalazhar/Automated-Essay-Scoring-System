const express = require('express');
const router = express.Router();

const {
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
} = require('../controllers/examController');

// ── GURU ──
router.post('/', createQuizWithQuestions);
router.post('/question', addQuestionWithKey);
router.get('/teacher/:teacher_id', getTeacherQuizzes);
router.get('/teacher/:teacher_id/attempts', getTeacherAttempts);

// ── MURID ──
router.get('/student/:student_id/available', getAvailableQuizzes);
router.get('/student/:student_id/attempts', getStudentAttempts);
router.get('/:quiz_id/start', getQuizQuestions);
router.post('/:quiz_id/submit', submitAnswers);

// ── HASIL ATTEMPT ──
router.get('/attempt/:attempt_token', getAttemptResult);

// ── APPROVAL (GURU) ──
router.put('/score/:score_id', updateScore);                          // edit skor + feedback
router.put('/score/:score_id/approve', approveScore);                 // approve 1 jawaban
router.put('/attempt/:attempt_token/approve-all', approveAllInAttempt); // approve semua

// CATATAN PENTING soal urutan route:
// Route '/score/...' dan '/attempt/...' harus didefinisikan SEBELUM
// route dinamis seperti '/:quiz_id/...' supaya tidak ketangkap duluan.
// Di file ini urutannya sudah benar karena '/score' dan '/attempt'
// adalah path statis yang spesifik.

module.exports = router;