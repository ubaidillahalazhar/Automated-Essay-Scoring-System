const express = require('express');
const router = express.Router();

// Mengimpor fungsi-fungsi dari examController (Pastikan namanya persis sama)
const { 
  createQuizWithQuestions, 
  addQuestionWithKey, 
  getTeacherQuizzes 
} = require('../controllers/examController');

// ==========================================
// RUTE UNTUK GURU (TEACHER)
// ==========================================

// 1. Membuat kuis beserta semua soalnya sekaligus
// Endpoint: POST /api/exams/
router.post('/', createQuizWithQuestions);

// 2. Menambahkan soal dan kunci jawaban secara manual/satuan
// Endpoint: POST /api/exams/question
router.post('/question', addQuestionWithKey);

// 3. Mengambil daftar kuis berdasarkan ID Guru
// Endpoint: GET /api/exams/teacher/:teacher_id
router.get('/teacher/:teacher_id', getTeacherQuizzes);

module.exports = router;