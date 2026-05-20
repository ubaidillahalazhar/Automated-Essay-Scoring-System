const express = require('express');
const router = express.Router();

// Mengimpor fungsi-fungsi dari examController
const { 
  createQuiz, 
  addQuestionWithKey, 
  getTeacherQuizzes 
} = require('../controllers/examController');

// ==========================================
// RUTE UNTUK GURU (TEACHER)
// ==========================================

// 1. Membuat kuis baru
// Endpoint: POST /api/exams/
router.post('/', createQuiz);

// 2. Menambahkan soal dan kunci jawaban ke dalam kuis
// Endpoint: POST /api/exams/question
router.post('/question', addQuestionWithKey);

// 3. Mengambil daftar kuis berdasarkan ID Guru
// Endpoint: GET /api/exams/teacher/:teacher_id
router.get('/teacher/:teacher_id', getTeacherQuizzes);

module.exports = router;