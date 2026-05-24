const express = require('express');
const router = express.Router();
const { getGradesByLevel } = require('../controllers/gradeController');

router.get('/', getGradesByLevel);

module.exports = router;