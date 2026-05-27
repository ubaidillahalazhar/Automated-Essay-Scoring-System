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
  getTeacherAttempts
} = require('../controllers/examController');

// ==========================================
// RUTE UNTUK GURU
// ==========================================
router.post('/', createQuizWithQuestions);
router.post('/question', addQuestionWithKey);
router.get('/teacher/:teacher_id', getTeacherQuizzes);
router.get('/teacher/:teacher_id/attempts', getTeacherAttempts); // BARU: list semua attempt siswa di quiz miliknya

// ==========================================
// RUTE UNTUK MURID
// ==========================================
router.get('/student/:student_id/available', getAvailableQuizzes);
router.get('/student/:student_id/attempts', getStudentAttempts); // BARU: list attempt miliknya sendiri

router.get('/:quiz_id/start', getQuizQuestions);
router.post('/:quiz_id/submit', submitAnswers);
router.get('/attempt/:attempt_token', getAttemptResult);

module.exports = router;
