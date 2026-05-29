const prisma = require('../config/prismaClient');

// Mengambil mata pelajaran khusus milik guru yang sedang login
const getTeacherSubjects = async (req, res) => {
  try {
    const paramId = parseInt(req.params.teacher_id);
    if (!paramId || req.user.userId !== paramId) {
      return res.status(403).json({ message: "Anda hanya boleh akses data sendiri." });
    }

    const subjects = await prisma.subject.findMany({
      where: { teacher_id: paramId },
      orderBy: { subject_name: 'asc' }
    });
    res.status(200).json({ status: "success", data: subjects });
  } catch (error) {
    console.error("❌ Error getTeacherSubjects:", error);
    res.status(500).json({ message: "Gagal mengambil mata pelajaran", error: error.message });
  }
};

// Menambahkan mata pelajaran baru ke database
const createSubject = async (req, res) => {
  try {
    const { subject_name } = req.body;
    const teacher_id = req.user.userId;
    
    // Cek apakah guru sudah pernah membuat mata pelajaran dengan nama yang sama persis
    const existingSubject = await prisma.subject.findFirst({
      where: {
        subject_name: subject_name,
        teacher_id: parseInt(teacher_id)
      }
    });

    if (existingSubject) {
      return res.status(400).json({ message: "Mata pelajaran ini sudah Anda buat sebelumnya." });
    }

    const newSubject = await prisma.subject.create({
      data: {
        subject_name,
        teacher_id: parseInt(teacher_id)
      }
    });

    res.status(201).json({ status: "success", data: newSubject });
  } catch (error) {
    console.error("❌ Error createSubject:", error);
    res.status(500).json({ message: "Gagal membuat mata pelajaran", error: error.message });
  }
};

module.exports = { getTeacherSubjects, createSubject };