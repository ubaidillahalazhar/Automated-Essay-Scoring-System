const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { isTeacher, isStudent } = require('../middleware/roleMiddleware');

const {
  createQuizWithQuestions, addQuestionWithKey,
  getTeacherQuizzes, getAvailableQuizzes, getQuizQuestions,
  submitAnswers, getAttemptResult,
  getStudentAttempts, getTeacherAttempts,
  updateScore, approveScore, approveAllInAttempt,
  getQuizForEdit, updateQuizWithQuestions, deleteQuiz   
} = require('../controllers/examController');

// GURU
router.post('/', authenticateToken, isTeacher, createQuizWithQuestions);
router.post('/question', authenticateToken, isTeacher, addQuestionWithKey);
router.get('/teacher/:teacher_id', authenticateToken, isTeacher, getTeacherQuizzes);
router.get('/teacher/:teacher_id/attempts', authenticateToken, isTeacher, getTeacherAttempts);

router.get('/:quiz_id/edit', authenticateToken, isTeacher, getQuizForEdit);
router.put('/:quiz_id', authenticateToken, isTeacher, updateQuizWithQuestions);
router.delete('/:quiz_id', authenticateToken, isTeacher, deleteQuiz);

// MURID
router.get('/student/:student_id/available', authenticateToken, isStudent, getAvailableQuizzes);
router.get('/student/:student_id/attempts', authenticateToken, isStudent, getStudentAttempts);
router.get('/:quiz_id/start', authenticateToken, isStudent, getQuizQuestions);
router.post('/:quiz_id/submit', authenticateToken, isStudent, submitAnswers);

// HASIL ATTEMPT
router.get('/attempt/:attempt_token', authenticateToken, getAttemptResult);

// APPROVAL (GURU)
router.put('/score/:score_id', authenticateToken, isTeacher, updateScore);
router.put('/score/:score_id/approve', authenticateToken, isTeacher, approveScore);
router.put('/attempt/:attempt_token/approve-all', authenticateToken, isTeacher, approveAllInAttempt);

module.exports = router;