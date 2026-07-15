require('dotenv').config();
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET tidak di-set. Server berhenti demi keamanan.');
  process.exit(1);
}
const express = require('express');
const prisma = require('./config/prismaClient');
const authRoutes = require('./routes/authRoutes');
const cors = require('cors');
const examRoutes = require('./routes/examRoutes');
const gradeRoutes = require('./routes/gradeRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const app = express();
const { notFound, errorHandler } = require('./middleware/errorHandler');

app.use(cors({
    origin: 'http://localhost:3000', // Izinkan frontend Anda
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true // Diperlukan jika Anda pakai cookies/token/session
}));

app.use(express.json()); // Agar bisa menerima format JSON
app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/grades', gradeRoutes);     // <-- TAMBAH INI
app.use('/api/subjects', subjectRoutes);


// Endpoint untuk mengetes koneksi database
app.get('/api/test-users', async (req, res) => {
  try {
    // Memanggil tabel User menggunakan Prisma
    const users = await prisma.user.findMany();
    res.json({
      message: "Koneksi sukses!",
      data: users
    });
  } catch (error) {
    console.error(error);
    const resp = { error: "Gagal terhubung ke database" };
    if (process.env.NODE_ENV !== 'production') resp.detail = error.message;
    res.status(500).json(resp);
  }
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});