require('dotenv').config();
const express = require('express');
const prisma = require('./config/prismaClient');
const authRoutes = require('./routes/authRoutes');
const cors = require('cors');
const examRoutes = require('./routes/examRoutes');

const app = express();

app.use(cors({
    origin: 'http://localhost:3000', // Izinkan frontend Anda
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true // Diperlukan jika Anda pakai cookies/token/session
}));

app.use(express.json()); // Agar bisa menerima format JSON
app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});