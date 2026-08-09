require('dotenv').config();
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET tidak di-set. Server berhenti demi keamanan.');
  process.exit(1);
}
const express = require('express');
const prisma = require('./config/prismaClient');
const logger = require('./utils/loggerUtils');
const authRoutes = require('./routes/authRoutes');
const cors = require('cors');
const examRoutes = require('./routes/examRoutes');
const gradeRoutes = require('./routes/gradeRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const chatRoutes = require('./routes/chatRoutes');
const app = express();
const { notFound, errorHandler } = require('./middleware/errorHandler');

app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true 
}));

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/chat', chatRoutes);

// Health check. Menggantikan /api/test-users yang dulu mengembalikan
// SELURUH tabel user tanpa autentikasi apa pun.
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    logger.error('Health check gagal:', error);
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});