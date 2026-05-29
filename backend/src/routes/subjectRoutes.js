const express = require('express');
const router = express.Router();
const { authenticateToken, isTeacher } = require('../middleware/authMiddleware');
const { getTeacherSubjects, createSubject } = require('../controllers/subjectController');

router.get('/teacher/:teacher_id', authenticateToken, isTeacher, getTeacherSubjects);
router.post('/', authenticateToken, isTeacher, createSubject);

module.exports = router;