"use client"

export type UserRole = "student" | "teacher"

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  class?: string
  subject?: string
}

export interface Question {
  id: string
  text: string
  type: "essay" | "multiple_choice"
  options?: string[]
  correctAnswer: string
  points: number
}

export interface Quiz {
  id: string
  title: string
  subject: string
  teacherId: string
  teacherName: string
  description: string
  timeLimit: number // minutes
  questions: Question[]
  createdAt: string
  dueDate: string
  isActive: boolean
  class: string
}

export interface Assignment {
  id: string
  quizId: string
  quizTitle: string
  subject: string
  teacherName: string
  dueDate: string
  status: "pending" | "completed" | "overdue"
  score?: number
  maxScore: number
  class: string
}

export interface StudentAnswer {
  questionId: string
  answer: string
  score?: number
  feedback?: string
  isCorrect?: boolean
}

export interface QuizAttempt {
  id: string
  quizId: string
  quizTitle: string
  studentId: string
  studentName: string
  studentClass: string
  answers: StudentAnswer[]
  totalScore: number
  maxScore: number
  completedAt: string
  timeTaken: number // seconds
  aiAnalysis?: string
}

// Mock Users
export const MOCK_USERS: User[] = [
  {
    id: "student-1",
    name: "Budi Santoso",
    email: "budi@student.com",
    role: "student",
    class: "Kelas 10A",
    avatar: "BS",
  },
  {
    id: "student-2",
    name: "Siti Rahayu",
    email: "siti@student.com",
    role: "student",
    class: "Kelas 10A",
    avatar: "SR",
  },
  {
    id: "student-3",
    name: "Ahmad Rizki",
    email: "ahmad@student.com",
    role: "student",
    class: "Kelas 10B",
    avatar: "AR",
  },
  {
    id: "teacher-1",
    name: "Bu Dewi Kusuma",
    email: "dewi@guru.com",
    role: "teacher",
    subject: "Matematika",
    avatar: "DK",
  },
  {
    id: "teacher-2",
    name: "Pak Hendra Wijaya",
    email: "hendra@guru.com",
    role: "teacher",
    subject: "Bahasa Indonesia",
    avatar: "HW",
  },
]

export const MOCK_QUIZZES: Quiz[] = [
  {
    id: "quiz-1",
    title: "Aljabar Linear Dasar",
    subject: "Matematika",
    teacherId: "teacher-1",
    teacherName: "Bu Dewi Kusuma",
    description: "Kuis tentang konsep dasar aljabar linear termasuk persamaan linear dan matriks.",
    timeLimit: 30,
    class: "Kelas 10A",
    createdAt: "2025-04-01",
    dueDate: "2025-04-15",
    isActive: true,
    questions: [
      {
        id: "q1",
        text: "Jelaskan apa yang dimaksud dengan persamaan linear dua variabel dan berikan satu contohnya!",
        type: "essay",
        correctAnswer: "Persamaan linear dua variabel adalah persamaan yang memiliki dua variabel dengan pangkat tertinggi satu, contoh: 2x + 3y = 6",
        points: 25,
      },
      {
        id: "q2",
        text: "Tentukan nilai x dan y dari sistem persamaan berikut: x + y = 5 dan 2x - y = 4. Jelaskan langkah-langkah penyelesaiannya!",
        type: "essay",
        correctAnswer: "Dengan eliminasi: tambahkan kedua persamaan: 3x = 9, x = 3. Substitusi: 3 + y = 5, y = 2. Jadi x = 3 dan y = 2.",
        points: 35,
      },
      {
        id: "q3",
        text: "Apa yang dimaksud dengan matriks identitas? Tuliskan contoh matriks identitas ordo 2x2!",
        type: "essay",
        correctAnswer: "Matriks identitas adalah matriks persegi dengan elemen diagonal utama bernilai 1 dan elemen lainnya 0. Contoh: [[1,0],[0,1]]",
        points: 20,
      },
      {
        id: "q4",
        text: "Diketahui matriks A = [[2,3],[1,4]] dan B = [[1,2],[3,1]]. Hitunglah hasil penjumlahan A + B!",
        type: "essay",
        correctAnswer: "A + B = [[2+1, 3+2],[1+3, 4+1]] = [[3,5],[4,5]]",
        points: 20,
      },
    ],
  },
  {
    id: "quiz-2",
    title: "Teks Narasi dan Deskripsi",
    subject: "Bahasa Indonesia",
    teacherId: "teacher-2",
    teacherName: "Pak Hendra Wijaya",
    description: "Memahami perbedaan teks narasi dan deskripsi serta ciri-cirinya.",
    timeLimit: 25,
    class: "Kelas 10A",
    createdAt: "2025-04-03",
    dueDate: "2025-04-18",
    isActive: true,
    questions: [
      {
        id: "q1",
        text: "Jelaskan perbedaan antara teks narasi dan teks deskripsi! Berikan masing-masing satu contoh kalimat!",
        type: "essay",
        correctAnswer: "Teks narasi menceritakan urutan kejadian/peristiwa, contoh: 'Andi berlari kencang menuju sekolah karena terlambat.' Teks deskripsi menggambarkan sesuatu secara detail, contoh: 'Bunga mawar itu berwarna merah menyala dengan kelopak yang lembut dan harum.'",
        points: 30,
      },
      {
        id: "q2",
        text: "Sebutkan dan jelaskan 3 ciri-ciri teks narasi!",
        type: "essay",
        correctAnswer: "1. Mengandung alur cerita (awal-tengah-akhir), 2. Ada tokoh dan penokohan, 3. Terdapat latar (waktu, tempat, suasana), 4. Menggunakan kata kerja aktif",
        points: 30,
      },
      {
        id: "q3",
        text: "Tuliskan sebuah paragraf deskripsi singkat (minimal 3 kalimat) tentang lingkungan sekolahmu!",
        type: "essay",
        correctAnswer: "Contoh paragraf deskripsi yang baik menggambarkan detail fisik, suasana, dan kesan indrawi dari lingkungan sekolah.",
        points: 40,
      },
    ],
  },
  {
    id: "quiz-3",
    title: "Persamaan Kuadrat",
    subject: "Matematika",
    teacherId: "teacher-1",
    teacherName: "Bu Dewi Kusuma",
    description: "Kuis tentang persamaan kuadrat dan cara penyelesaiannya.",
    timeLimit: 35,
    class: "Kelas 10B",
    createdAt: "2025-04-05",
    dueDate: "2025-04-20",
    isActive: true,
    questions: [
      {
        id: "q1",
        text: "Jelaskan apa yang dimaksud dengan persamaan kuadrat dan bentuk umumnya!",
        type: "essay",
        correctAnswer: "Persamaan kuadrat adalah persamaan polinomial berderajat dua dengan bentuk umum ax² + bx + c = 0, dimana a ≠ 0.",
        points: 20,
      },
      {
        id: "q2",
        text: "Selesaikan persamaan kuadrat x² - 5x + 6 = 0 dengan cara memfaktorkan! Jelaskan langkah-langkahnya.",
        type: "essay",
        correctAnswer: "x² - 5x + 6 = 0 → (x-2)(x-3) = 0 → x = 2 atau x = 3. Langkah: cari dua bilangan yang jika dikali = 6 dan dijumlah = -5, yaitu -2 dan -3.",
        points: 40,
      },
      {
        id: "q3",
        text: "Apa itu diskriminan (D) dalam persamaan kuadrat? Jelaskan ketiga kemungkinan nilainya!",
        type: "essay",
        correctAnswer: "Diskriminan D = b² - 4ac. Jika D > 0: dua akar real berbeda. Jika D = 0: dua akar real sama. Jika D < 0: tidak ada akar real (akar imajiner).",
        points: 40,
      },
    ],
  },
]

export const MOCK_ATTEMPTS: QuizAttempt[] = [
  {
    id: "attempt-1",
    quizId: "quiz-1",
    quizTitle: "Aljabar Linear Dasar",
    studentId: "student-1",
    studentName: "Budi Santoso",
    studentClass: "Kelas 10A",
    completedAt: "2025-04-10T09:30:00",
    timeTaken: 1620,
    totalScore: 82,
    maxScore: 100,
    answers: [
      {
        questionId: "q1",
        answer: "Persamaan linear dua variabel adalah persamaan yang mengandung dua variabel dengan pangkat satu. Contohnya 2x + y = 7.",
        score: 22,
        isCorrect: true,
        feedback: "Jawaban sudah benar dan contoh tepat, namun penjelasan bisa lebih lengkap.",
      },
      {
        questionId: "q2",
        answer: "Dari persamaan pertama: x = 5 - y. Substitusi ke persamaan kedua: 2(5-y) - y = 4, 10 - 2y - y = 4, 10 - 3y = 4, 3y = 6, y = 2. Maka x = 5 - 2 = 3.",
        score: 35,
        isCorrect: true,
        feedback: "Sempurna! Langkah penyelesaian sangat jelas dan sistematis.",
      },
      {
        questionId: "q3",
        answer: "Matriks identitas adalah matriks dengan angka 1 di diagonal. Contoh: [[1,0],[0,1]]",
        score: 15,
        isCorrect: true,
        feedback: "Benar, tapi definisi kurang lengkap.",
      },
      {
        questionId: "q4",
        answer: "A + B = [[3,5],[4,5]]",
        score: 10,
        isCorrect: false,
        feedback: "Hasil akhir benar tapi tidak menampilkan langkah-langkah perhitungan.",
      },
    ],
    aiAnalysis: "Budi menunjukkan pemahaman yang baik terhadap konsep aljabar linear dasar. Kekuatan utama terlihat pada kemampuan substitusi dan eliminasi. Disarankan untuk lebih melatih penulisan langkah-langkah yang sistematis terutama pada soal matriks.",
  },
  {
    id: "attempt-2",
    quizId: "quiz-1",
    quizTitle: "Aljabar Linear Dasar",
    studentId: "student-2",
    studentName: "Siti Rahayu",
    studentClass: "Kelas 10A",
    completedAt: "2025-04-10T10:15:00",
    timeTaken: 1800,
    totalScore: 91,
    maxScore: 100,
    answers: [
      {
        questionId: "q1",
        answer: "Persamaan linear dua variabel adalah persamaan matematika yang memiliki dua variabel (biasanya x dan y) dengan masing-masing berderajat satu. Contoh: 3x + 2y = 10.",
        score: 25,
        isCorrect: true,
        feedback: "Excellent! Penjelasan lengkap dan contoh tepat.",
      },
      {
        questionId: "q2",
        answer: "Dengan metode eliminasi: tambahkan kedua persamaan, (x+y) + (2x-y) = 5+4, 3x = 9, x = 3. Substitusi ke persamaan 1: 3 + y = 5, y = 2. Jawaban: x=3, y=2.",
        score: 35,
        isCorrect: true,
        feedback: "Sempurna! Metode eliminasi digunakan dengan benar.",
      },
      {
        questionId: "q3",
        answer: "Matriks identitas adalah matriks persegi yang elemen diagonal utamanya bernilai 1 dan semua elemen lainnya 0. Contoh ordo 2x2: I = [[1,0],[0,1]]",
        score: 20,
        isCorrect: true,
        feedback: "Jawaban sempurna!",
      },
      {
        questionId: "q4",
        answer: "A + B = [[2+1, 3+2],[1+3, 4+1]] = [[3,5],[4,5]]",
        score: 11,
        isCorrect: true,
        feedback: "Benar, langkah terlihat jelas.",
      },
    ],
    aiAnalysis: "Siti Rahayu menunjukkan penguasaan materi yang sangat baik. Kemampuan konseptual dan prosedural sama-sama kuat. Disarankan untuk terus mempertahankan kebiasaan menuliskan langkah-langkah secara rinci.",
  },
  {
    id: "attempt-3",
    quizId: "quiz-2",
    quizTitle: "Teks Narasi dan Deskripsi",
    studentId: "student-1",
    studentName: "Budi Santoso",
    studentClass: "Kelas 10A",
    completedAt: "2025-04-12T11:00:00",
    timeTaken: 1200,
    totalScore: 74,
    maxScore: 100,
    answers: [
      {
        questionId: "q1",
        answer: "Teks narasi adalah teks yang menceritakan suatu kisah. Teks deskripsi menggambarkan objek secara detail. Contoh narasi: Dia berlari menuju pasar. Contoh deskripsi: Pasar itu ramai dan bising.",
        score: 22,
        isCorrect: true,
        feedback: "Cukup baik, namun contoh kalimat deskripsi kurang menunjukkan detail yang kaya.",
      },
      {
        questionId: "q2",
        answer: "Ciri teks narasi: 1. Ada alur cerita, 2. Ada tokoh, 3. Ada latar tempat dan waktu.",
        score: 24,
        isCorrect: true,
        feedback: "Benar, namun penjelasan tiap ciri masih sangat singkat.",
      },
      {
        questionId: "q3",
        answer: "Sekolahku besar dan bersih. Halamannya luas dengan banyak pohon. Ada kantin yang selalu ramai saat istirahat.",
        score: 28,
        isCorrect: true,
        feedback: "Paragraf sudah cukup baik tapi bisa diperkaya dengan detail indrawi.",
      },
    ],
    aiAnalysis: "Budi memiliki pemahaman dasar yang cukup tentang teks narasi dan deskripsi. Perlu peningkatan dalam hal pengembangan paragraf yang lebih kaya dan penggunaan kosakata yang lebih beragam.",
  },
]

// localStorage helpers
export const AUTH_KEY = "eduquiz_user"
export const QUIZZES_KEY = "eduquiz_quizzes"
export const ATTEMPTS_KEY = "eduquiz_attempts"

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(AUTH_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function setStoredUser(user: User | null) {
  if (typeof window === "undefined") return
  if (user) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(AUTH_KEY)
  }
}

export function getStoredQuizzes(): Quiz[] {
  if (typeof window === "undefined") return MOCK_QUIZZES
  try {
    const stored = localStorage.getItem(QUIZZES_KEY)
    return stored ? JSON.parse(stored) : MOCK_QUIZZES
  } catch {
    return MOCK_QUIZZES
  }
}

export function saveQuizzes(quizzes: Quiz[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(QUIZZES_KEY, JSON.stringify(quizzes))
}

export function getStoredAttempts(): QuizAttempt[] {
  if (typeof window === "undefined") return MOCK_ATTEMPTS
  try {
    const stored = localStorage.getItem(ATTEMPTS_KEY)
    return stored ? JSON.parse(stored) : MOCK_ATTEMPTS
  } catch {
    return MOCK_ATTEMPTS
  }
}

export function saveAttempts(attempts: QuizAttempt[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts))
}
