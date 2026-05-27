// File: backend/src/controllers/gradeController.js (BUAT BARU)
// Endpoint untuk frontend ambil daftar Grade (dropdown signup, dll)

const prisma = require('../config/prismaClient');

/**
 * GET /api/grades
 * Mengambil semua grade yang tersedia, di-group by school_level.
 * Bisa difilter dengan ?level=SD untuk hanya ambil grade SD.
 */
const getAllGrades = async (req, res) => {
  try {
    const { level } = req.query;

    const where = level ? { school_level: level } : {};

    const grades = await prisma.grade.findMany({
      where,
      orderBy: [
        { school_level: 'asc' },
        { grade_id: 'asc' }
      ]
    });

    // Group by school_level untuk memudahkan tampilan
    const grouped = {};
    for (const g of grades) {
      if (!grouped[g.school_level]) grouped[g.school_level] = [];
      grouped[g.school_level].push({
        grade_id: g.grade_id,
        grade_name: g.grade_name
      });
    }

    res.status(200).json({
      status: "success",
      data: grades,
      grouped
    });
  } catch (error) {
    console.error("❌ Error getAllGrades:", error);
    res.status(500).json({ message: "Gagal mengambil daftar kelas", error: error.message });
  }
};

module.exports = { getAllGrades };
