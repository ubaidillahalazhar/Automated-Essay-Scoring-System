const axios = require('axios');

// Fungsi ini akan dipanggil oleh controller nanti
const gradeEssayWithAI = async (soal, kunci_jawaban, jawaban_siswa) => {
  try {
    // Ambil URL Ngrok dari file .env
    const aiUrl = process.env.AI_GRADER_URL || 'http://localhost:8000/grade';
    
    const response = await axios.post(aiUrl, {
      soal: soal,
      kunci_jawaban: kunci_jawaban,
      jawaban_siswa: jawaban_siswa
    });

    // Mengembalikan data JSON dari FastAPI (skor, nilai_100, alasan, dll)
    return response.data; 
  } catch (error) {
    console.error("❌ Error dari AI Service:", error.message);
    throw new Error("Gagal menghubungi layanan Grader AI");
  }
};

module.exports = { gradeEssayWithAI };