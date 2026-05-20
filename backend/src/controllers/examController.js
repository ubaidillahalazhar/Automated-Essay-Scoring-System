const prisma = require('../config/prismaClient');

// ==========================================
// 1. MEMBUAT KUIS & SOAL SEKALIGUS (BULK INSERT)
// ==========================================
const createQuizWithQuestions = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      subject, 
      timeLimit, 
      targetClass, 
      dueDate, 
      created_by, 
      questions 
    } = req.body;

    // Buka transaksi
    const result = await prisma.$transaction(async (tx) => {
      
      // A. Buat Kuis Utama
      const quiz = await tx.quiz.create({
        data: {
          title,
          description,
          subject,
          time_limit: parseInt(timeLimit),       
          target_class: targetClass,             
          due_date: new Date(dueDate),           
          created_by: parseInt(created_by)       
        }
      });

      // B. Looping untuk membuat soal dan kunci jawaban (yang sebelumnya terpotong)
      for (const q of questions) {
        const newQuestion = await tx.essayQuestion.create({
          data: {
            quiz_id: quiz.quiz_id,    
            question_text: q.text,    
            weight: q.points          
          }
        });

        await tx.answerKey.create({
          data: {
            question_id: newQuestion.question_id, 
            key_text: q.correctAnswer             
          }
        });
      }

      // Kembalikan data kuis agar bisa dikirim di response
      return quiz;
    }); // <-- Penutup transaksi yang sebelumnya hilang

    // Berikan respons sukses menggunakan variabel 'result' dari transaksi
    res.status(201).json({
      status: "success",
      message: "Kuis beserta semua soal berhasil dibuat!",
      data: result
    });

  } catch (error) {
    console.error("❌ Error createQuizWithQuestions:", error);
    res.status(500).json({ message: "Gagal membuat kuis", error: error.message });
  }
};

// ==========================================
// 2. MENAMBAHKAN SOAL DAN KUNCI JAWABAN (Manual / Satuan)
// ==========================================
const addQuestionWithKey = async (req, res) => {
  try {
    const { quiz_id, question_text, weight, key_text } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const newQuestion = await tx.essayQuestion.create({
        data: {
          quiz_id,
          question_text,
          weight: weight || 1.00 
        }
      });

      const newAnswerKey = await tx.answerKey.create({
        data: {
          question_id: newQuestion.question_id,
          key_text
        }
      });

      return { question: newQuestion, answerKey: newAnswerKey };
    });

    res.status(201).json({
      message: "Soal dan Kunci Jawaban berhasil ditambahkan!",
      data: result
    });
  } catch (error) {
    console.error("❌ Error addQuestionWithKey:", error);
    res.status(500).json({ message: "Gagal menambahkan soal", error: error.message });
  }
};

// ==========================================
// 3. MENGAMBIL DAFTAR KUIS MILIK GURU (Untuk Dashboard)
// ==========================================
const getTeacherQuizzes = async (req, res) => {
  try {
    const { teacher_id } = req.params;

    const quizzes = await prisma.quiz.findMany({
      where: { 
        created_by: parseInt(teacher_id) 
      },
      include: {
        _count: {
          select: { questions: true } 
        }
      },
      orderBy: { 
        created_at: 'desc' 
      }
    });

    res.status(200).json({
      message: "Berhasil mengambil data kuis",
      data: quizzes
    });
  } catch (error) {
    console.error("❌ Error getTeacherQuizzes:", error);
    res.status(500).json({ message: "Gagal mengambil data kuis", error: error.message });
  }
};

module.exports = {
  createQuizWithQuestions,
  addQuestionWithKey,
  getTeacherQuizzes
};