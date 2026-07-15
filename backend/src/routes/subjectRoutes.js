const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { isTeacher } = require('../middleware/roleMiddleware');
const { getTeacherSubjects, createSubject } = require('../controllers/subjectController');

router.get('/teacher/:teacher_id', authenticateToken, isTeacher, getTeacherSubjects);
router.post('/', authenticateToken, isTeacher, createSubject);

module.exports = router;