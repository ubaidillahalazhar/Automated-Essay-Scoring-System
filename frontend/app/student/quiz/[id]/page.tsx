"use client"

import { useEffect, useState, useCallback, use } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  getStoredQuizzes, getStoredAttempts, saveAttempts,
  type Quiz, type StudentAnswer, type QuizAttempt
} from "@/lib/store"
import { Clock, ChevronLeft, ChevronRight, AlertTriangle, BookOpen } from "lucide-react"

function gradeAnswer(userAnswer: string, correctAnswer: string, points: number): { score: number; feedback: string; isCorrect: boolean } {
  if (!userAnswer.trim()) return { score: 0, feedback: "Tidak ada jawaban yang diberikan.", isCorrect: false }
  const userWords = new Set(userAnswer.toLowerCase().split(/\s+/).filter((w) => w.length > 3))
  const correctWords = new Set(correctAnswer.toLowerCase().split(/\s+/).filter((w) => w.length > 3))
  let overlap = 0
  userWords.forEach((w) => { if (correctWords.has(w)) overlap++ })
  const similarity = correctWords.size > 0 ? overlap / correctWords.size : 0
  const score = Math.round(similarity * points * 0.9 + (userAnswer.length > 20 ? points * 0.1 : 0))
  const capped = Math.min(score, points)
  const pct = capped / points
  const feedback = pct >= 0.85
    ? "Jawaban sangat baik! Mencakup poin-poin utama dengan tepat."
    : pct >= 0.65
    ? "Jawaban cukup baik. Beberapa poin sudah benar namun masih kurang lengkap."
    : pct >= 0.4
    ? "Jawaban kurang lengkap. Perlu menambahkan lebih banyak detail."
    : "Jawaban belum mencakup poin-poin penting. Coba pelajari materi kembali."
  return { score: capped, feedback, isCorrect: pct >= 0.5 }
}

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [started, setStarted] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [startTime] = useState(Date.now())

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "student")) router.replace("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    const q = getStoredQuizzes().find((q) => q.id === id)
    if (q) {
      setQuiz(q)
      setTimeLeft(q.timeLimit * 60)
    }
  }, [id])

  const submitQuiz = useCallback(() => {
    if (!quiz || !user || submitted) return
    setSubmitted(true)
    const gradedAnswers: StudentAnswer[] = quiz.questions.map((q) => {
      const userAnswer = answers[q.id] || ""
      const { score, feedback, isCorrect } = gradeAnswer(userAnswer, q.correctAnswer, q.points)
      return { questionId: q.id, answer: userAnswer, score, feedback, isCorrect }
    })
    const totalScore = gradedAnswers.reduce((s, a) => s + (a.score || 0), 0)
    const maxScore = quiz.questions.reduce((s, q) => s + q.points, 0)
    const timeTaken = Math.floor((Date.now() - startTime) / 1000)
    const attempt: QuizAttempt = {
      id: `attempt-${Date.now()}`,
      quizId: quiz.id,
      quizTitle: quiz.title,
      studentId: user.id,
      studentName: user.name,
      studentClass: user.class || "",
      answers: gradedAnswers,
      totalScore,
      maxScore,
      completedAt: new Date().toISOString(),
      timeTaken,
    }
    const existing = getStoredAttempts()
    saveAttempts([...existing, attempt])
    router.push(`/student/results/${attempt.id}`)
  }, [quiz, user, answers, submitted, startTime, router])

  useEffect(() => {
    if (!started || submitted) return
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(interval); submitQuiz(); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [started, submitted, submitQuiz])

  if (isLoading || !user || !quiz) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const totalQuestions = quiz.questions.length
  const answeredCount = Object.values(answers).filter((a) => a.trim()).length
  const progress = ((currentQ + 1) / totalQuestions) * 100
  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const timeWarning = timeLeft < 120
  const currentQuestion = quiz.questions[currentQ]

  // Start screen
  if (!started) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl border border-border p-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">{quiz.title}</h1>
            <p className="text-muted-foreground mb-6">{quiz.description}</p>
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: "Soal", value: `${totalQuestions}` },
                { label: "Waktu", value: `${quiz.timeLimit} mnt` },
                { label: "Mata Pelajaran", value: quiz.subject },
              ].map((info) => (
                <div key={info.label} className="bg-muted rounded-xl p-3">
                  <p className="text-lg font-bold text-foreground">{info.value}</p>
                  <p className="text-xs text-muted-foreground">{info.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-1">Perhatian:</p>
                  <ul className="space-y-1 text-amber-700">
                    <li>Kuis akan otomatis diselesaikan saat waktu habis.</li>
                    <li>Jawab semua pertanyaan dengan lengkap dan jelas.</li>
                    <li>Tidak dapat kembali setelah kuis selesai.</li>
                  </ul>
                </div>
              </div>
            </div>
            <button
              onClick={() => setStarted(true)}
              className="w-full py-3.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors text-lg"
            >
              Mulai Kuis
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-border px-4 lg:px-8 py-3 flex items-center gap-4 sticky top-0 z-20">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{quiz.title}</p>
          <p className="text-xs text-muted-foreground">{quiz.subject}</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold text-sm flex-shrink-0 ${timeWarning ? "bg-red-50 text-red-600 animate-pulse" : "bg-muted text-foreground"}`}>
          <Clock className="w-4 h-4" />
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
        <div className="text-sm text-muted-foreground flex-shrink-0">{answeredCount}/{totalQuestions}</div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col lg:flex-row max-w-5xl mx-auto w-full p-4 lg:p-8 gap-6">
        {/* Main question area */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Question number */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              Soal {currentQ + 1} dari {totalQuestions}
            </span>
            <span className="text-xs text-muted-foreground">• {currentQuestion.points} poin</span>
          </div>

          {/* Question card */}
          <div className="bg-white rounded-2xl border border-border p-6">
            <p className="text-foreground leading-relaxed font-medium text-base">{currentQuestion.text}</p>
          </div>

          {/* Answer textarea */}
          <div className="flex-1 flex flex-col">
            <label className="text-sm font-medium text-foreground mb-2">Jawaban Kamu</label>
            <textarea
              value={answers[currentQuestion.id] || ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))}
              placeholder="Tulis jawabanmu di sini secara lengkap dan jelas..."
              className="flex-1 min-h-[200px] px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition resize-none text-sm leading-relaxed"
            />
            <p className="text-xs text-muted-foreground mt-1.5 text-right">
              {(answers[currentQuestion.id] || "").length} karakter
            </p>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentQ((p) => Math.max(0, p - 1))}
              disabled={currentQ === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Sebelumnya
            </button>
            <div className="flex-1" />
            {currentQ < totalQuestions - 1 ? (
              <button
                onClick={() => setCurrentQ((p) => Math.min(totalQuestions - 1, p + 1))}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Selanjutnya <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors"
              >
                Selesai & Kirim
              </button>
            )}
          </div>
        </div>

        {/* Question navigator sidebar */}
        <div className="lg:w-52 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-border p-4 sticky top-24">
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Navigasi Soal</p>
            <div className="grid grid-cols-5 lg:grid-cols-4 gap-2 mb-4">
              {quiz.questions.map((q, i) => {
                const answered = !!(answers[q.id]?.trim())
                const active = i === currentQ
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQ(i)}
                    className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${
                      active ? "bg-primary text-primary-foreground ring-2 ring-primary/30" :
                      answered ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-100 border border-green-300" /><span className="text-muted-foreground">Sudah dijawab</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-muted" /><span className="text-muted-foreground">Belum dijawab</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-primary" /><span className="text-muted-foreground">Sedang dikerjakan</span></div>
            </div>
            {answeredCount === totalQuestions && (
              <button
                onClick={() => setShowConfirm(true)}
                className="mt-4 w-full py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-colors"
              >
                Kirim Jawaban
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-foreground mb-2">Kirim Jawaban?</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Kamu telah menjawab <strong>{answeredCount}</strong> dari <strong>{totalQuestions}</strong> soal.
            </p>
            {answeredCount < totalQuestions && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 text-xs text-amber-700">
                {totalQuestions - answeredCount} soal belum dijawab. Soal kosong akan mendapat nilai 0.
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Kembali
              </button>
              <button
                onClick={submitQuiz}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors"
              >
                Ya, Kirim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
