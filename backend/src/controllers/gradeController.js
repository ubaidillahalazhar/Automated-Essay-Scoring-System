const prisma = require('../config/prismaClient');

const getGradesByLevel = async (req, res) => {
  try {
    // Ambil parameter level dari frontend (misal: "SD", "SMP", "SMA")
    // Default fallback ke "SD" jika tidak ada
    const level = req.query.level || "SD"; 

    const grades = await prisma.grade.findMany({
      where: { school_level: level },
      orderBy: { grade_id: 'asc' }
    });

    res.status(200).json({ status: "success", data: grades });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data kelas", error: error.message });
  }
};

module.exports = { getGradesByLevel };