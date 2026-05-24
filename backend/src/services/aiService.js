const axios = require('axios');

// Timeout default 90 detik. CPU inference 1 essay bisa makan 30-60 detik
// untuk Qwen3-4B Q4_K_M. Bisa di-override via env AI_TIMEOUT_MS.
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '90000', 10);

const gradeEssayWithAI = async (soal, kunci_jawaban, jawaban_siswa) => {
  const aiUrl = process.env.AI_GRADER_URL || 'http://localhost:8000/grade';

  try {
    const response = await axios.post(
      aiUrl,
      { soal, kunci_jawaban, jawaban_siswa },
      { timeout: AI_TIMEOUT_MS, headers: { 'Content-Type': 'application/json' } }
    );

    const data = response.data;

    // Validasi minimal: pastikan field yang dipakai controller ada
    if (
      typeof data?.skor !== 'number' ||
      typeof data?.nilai_100 !== 'number' ||
      typeof data?.alasan !== 'string'
    ) {
      throw new Error(
        `AI service mengembalikan format tidak valid: ${JSON.stringify(data)}`
      );
    }

    return data; // { skor, nilai_100, alasan }
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error(`❌ AI Service timeout setelah ${AI_TIMEOUT_MS}ms`);
      throw new Error(
        `Layanan AI tidak merespons dalam ${AI_TIMEOUT_MS / 1000} detik. ` +
        'Coba lagi atau hubungi admin.'
      );
    }
    if (error.code === 'ECONNREFUSED') {
      console.error(`❌ AI Service tidak dapat dihubungi di ${aiUrl}`);
      throw new Error(
        'Layanan AI tidak aktif. Pastikan server FastAPI berjalan.'
      );
    }
    console.error('❌ Error dari AI Service:', error.message);
    throw new Error(`Gagal menghubungi layanan Grader AI: ${error.message}`);
  }
};

module.exports = { gradeEssayWithAI };