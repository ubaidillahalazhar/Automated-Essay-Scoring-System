const express = require('express');
const router = express.Router();
const { getTeacherSubjects, createSubject } = require('../controllers/subjectController');

// Rute untuk mengambil data mapel milik guru
router.get('/teacher/:teacher_id', getTeacherSubjects);

// Rute untuk membuat mapel baru
router.post('/', createSubject);

module.exports = router;