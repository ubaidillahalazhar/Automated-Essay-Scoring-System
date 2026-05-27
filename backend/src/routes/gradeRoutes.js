// File: backend/src/routes/gradeRoutes.js (BUAT BARU)

const express = require('express');
const router = express.Router();
const { getAllGrades } = require('../controllers/gradeController');

router.get('/', getAllGrades);

module.exports = router;
