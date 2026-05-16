const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createQuiz = async (req, res) => {
  try {
    // Asumsi: req.user di-set oleh middleware autentikasi JWT kamu
    const userId = req.user.user_id; 
    const roleId = req.user.role_id; 

    // Fail-secure role checking
    if (roleId !== 1) {
      return res.status(403).json({ 
        success: false, 
        message: 'Forbidden: Hanya guru yang dapat membuat kuis.' 
      });
    }

    const { title, description, subject, questions } = req.body;

    // Validasi data input utama
    if (!title || !subject || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Judul, subjek, dan minimal satu soal harus diisi dengan benar.' 
      });
    }

    // Eksekusi Nested Write Prisma
    const newQuiz = await prisma.quiz.create({
      data: {
        title,
        description: description || null,
        subject,
        created_by: userId, // Menghubungkan kuis ke Guru yang sedang login
        questions: {
          create: questions.map((q) => ({
            question_text: q.question_text,
            weight: q.weight || 1.00,
            answerKey: {
              create: {
                key_text: q.key_text // Otomatis membuat data di tabel AnswerKey
              }
            }
          }))
        }
      },
      // Mengembalikan response data yang lengkap beserta soal dan kunci jawabannya
      include: {
        questions: {
          include: {
            answerKey: true
          }
        }
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Kuis beserta soal berhasil dibuat!',
      data: newQuiz,
    });

  } catch (error) {
    console.error('[Quiz Creation Error]:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan pada server saat membuat kuis.' 
    });
  }
};

module.exports = {
  createQuiz,
};