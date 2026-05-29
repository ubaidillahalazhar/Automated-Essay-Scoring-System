"use client"

import { useEffect, useState, useCallback, use } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  Clock, ChevronLeft, ChevronRight, AlertTriangle, BookOpen,
  Loader2, AlertCircle, CheckCircle2, Sparkles
} from "lucide-react"
import { apiFetch } from "@/lib/api"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

// ─────────────────────────────────────────────────────────────────────
// Tipe data dari backend
// ─────────────────────────────────────────────────────────────────────
interface QuestionFromDB {
  question_id: number
  question_text: string
  weight: number
}

interface QuizFromDB {
  quiz_id: number
  title: string
  description: string | null
  time_limit: number
  due_date: string
  teacher?: { name: string } | null
  subject?: { subject_name: string } | null
  grade?: { grade_name: string; school_level: string } | null
  questions: QuestionFromDB[]
}

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, isLoading } = useAuth()
  const router = useRouter()

  // ─── State data ───
  const [quiz, setQuiz] = useState<QuizFromDB | null>(null)
  const [loadingQuiz, setLoadingQuiz] = useState(true)
  const [loadError, setLoadError] = useState<string>("")

  // ─── State quiz session ───
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [started, setStarted] = useState(false)
  const [startTime, setStartTime] = useState<number>(0)

  // ─── State submission ───
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string>("")
  const [showConfirm, setShowConfirm] = useState(false)

  // ─── State validasi quiz ───
  const [isOverdue, setIsOverdue] = useState(false)
  const [alreadyDone, setAlreadyDone] = useState(false)

  // Redirect kalau bukan siswa
  useEffect(() => {
    if (!isLoading && (!user || user.role !== "student")) router.replace("/login")
  }, [user, isLoading, router])

  // Fetch quiz dari backend
  useEffect(() => {
    let cancelled = false

    async function fetchQuiz() {
      setLoadingQuiz(true)
      setLoadError("")
      try {
        const res = await apiFetch(`/api/exams/${id}/start`)
        const json = await res.json()
        if (cancelled) return

        if (!res.ok) {
          setLoadError(json.message || "Gagal memuat kuis.")
          setQuiz(null)
        } else {
          const data: QuizFromDB = json.data
          setQuiz(data)
          setTimeLeft((data.time_limit || 30) * 60)

          // Cek apakah due_date sudah lewat
          if (new Date(data.due_date) < new Date()) {
            setIsOverdue(true)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError("Tidak dapat menghubungi server.")
          setQuiz(null)
        }
      } finally {
        if (!cancelled) setLoadingQuiz(false)
      }
    }

    if (id) fetchQuiz()
    return () => { cancelled = true }
  }, [id])

  // Cek apakah siswa sudah pernah kerjakan quiz ini
  useEffect(() => {
    if (!user || !quiz) return
    let cancelled = false

    async function checkIfDone() {
      try {
        const res = await apiFetch(`/api/exams/student/${user!.id}/attempts`)
        const json = await res.json()
        if (cancelled) return
        if (res.ok && Array.isArray(json.data)) {
          const found = json.data.some((a: any) => a.quiz_id === quiz!.quiz_id)
          if (found) setAlreadyDone(true)
        }
      } catch (err) {
        // ignore
      }
    }
    checkIfDone()
    return () => { cancelled = true }
  }, [user, quiz])

  // ─── Submit handler ───
  const submitQuiz = useCallback(async () => {
    if (!quiz || !user || submitted || submitting) return

    setSubmitting(true)
    setSubmitError("")

    try {
      const timeTaken = startTime > 0 ? Math.floor((Date.now() - startTime) / 1000) : 0

      const payload = {
        user_id: user.id,
        time_taken: timeTaken,
        answers: quiz.questions.map((q) => ({
          question_id: q.question_id,
          answer_text: answers[q.question_id] || ""
        }))
      }

      // Timeout dinamis: 90 detik per soal (untuk AI grading), minimum 60 detik
      const controller = new AbortController()
      const timeoutMs = Math.max(60_000, quiz.questions.length * 90_000)
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      const response = await apiFetch(
  `/api/exams/${quiz.quiz_id}/submit`,
  {
    method: 'POST',
    body: JSON.stringify(payload),
    signal: controller.signal
  }
)

      clearTimeout(timeoutId)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || "Gagal mengirim jawaban ke server.")
      }

      const attemptToken = result.data?.attempt_token
      if (!attemptToken) {
        throw new Error("Server tidak mengembalikan token attempt.")
      }

      setSubmitted(true)
      router.push(`/student/results/${attemptToken}`)
    } catch (err: any) {
      console.error("❌ Submit gagal:", err)
      const msg = err.name === 'AbortError'
        ? "Penilaian AI memakan waktu terlalu lama. Coba lagi atau hubungi guru."
        : (err.message || "Terjadi kesalahan koneksi ke server.")
      setSubmitError(msg)
      setSubmitting(false)
    }
  }, [quiz, user, answers, submitted, submitting, startTime, router])

  // Timer countdown
  useEffect(() => {
    if (!started || submitted || submitting) return
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(interval); submitQuiz(); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [started, submitted, submitting, submitQuiz])

  // ─────────────────────────────────────────────────────────────────
  // RENDER STATES
  // ─────────────────────────────────────────────────────────────────

  // Loading initial
  if (isLoading || loadingQuiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    )
  }

  // Error load quiz
  if (loadError || !quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="bg-white rounded-2xl border border-border p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Kuis tidak dapat dimuat</h2>
          <p className="text-muted-foreground text-sm mb-5">{loadError || "Data kuis tidak ditemukan."}</p>
          <button
            onClick={() => router.push("/student/assignments")}
            className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition"
          >
            Kembali ke Tugas
          </button>
        </div>
      </div>
    )
  }

  if (!user) return null

  // ── State: Quiz sudah dikerjakan ──
  if (alreadyDone && !started) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-border p-8 max-w-md text-center">
          <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Kuis Sudah Dikerjakan</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Kamu sudah mengerjakan kuis <strong>{quiz.title}</strong>. Lihat nilaimu di halaman hasil.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/student/assignments")}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition"
            >
              Kembali
            </button>
            <button
              onClick={() => router.push("/student/results")}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition"
            >
              Lihat Nilai
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── State: Quiz sudah lewat tenggat ──
  if (isOverdue && !started) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-md text-center">
          <AlertTriangle className="w-14 h-14 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Sudah Lewat Tenggat</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Kuis <strong>{quiz.title}</strong> sudah lewat batas waktu pengerjaan
            ({new Date(quiz.due_date).toLocaleDateString("id-ID", {
              day: "numeric", month: "long", year: "numeric"
            })}).
          </p>
          <button
            onClick={() => router.push("/student/assignments")}
            className="w-full px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition"
          >
            Kembali ke Tugas
          </button>
        </div>
      </div>
    )
  }

  const totalQuestions = quiz.questions.length
  const answeredCount = Object.values(answers).filter((a) => a.trim()).length
  const progress = ((currentQ + 1) / totalQuestions) * 100
  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const timeWarning = timeLeft < 120
  const currentQuestion = quiz.questions[currentQ]

  // ── State: AI sedang menilai ──
  if (submitting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center bg-white rounded-2xl border border-border p-8">
          <div className="relative w-16 h-16 mx-auto mb-5">
            <div className="absolute inset-0 bg-primary/10 rounded-2xl animate-pulse" />
            <Sparkles className="w-8 h-8 text-primary absolute inset-0 m-auto" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            AI sedang menilai jawabanmu...
          </h2>
          <p className="text-muted-foreground text-sm mb-4">
            Proses ini bisa memakan waktu beberapa menit, terutama jika soalnya banyak.
            <br />
            <strong>Jangan tutup atau refresh halaman ini.</strong>
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Menilai {totalQuestions} jawaban...
          </div>
          {submitError && (
            <div className="mt-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {submitError}
              <button
                onClick={() => router.push("/student/assignments")}
                className="block mt-3 mx-auto px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
              >
                Kembali
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── State: Start screen (belum mulai) ──
  if (!started) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl border border-border p-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>

            {quiz.subject?.subject_name && (
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">
                {quiz.subject.subject_name}
                {quiz.grade?.grade_name && ` · ${quiz.grade.grade_name}`}
              </p>
            )}

            <h1 className="text-2xl font-bold text-foreground mb-2">{quiz.title}</h1>
            {quiz.description && (
              <p className="text-muted-foreground mb-6">{quiz.description}</p>
            )}

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">Soal</p>
                <p className="font-bold text-foreground text-sm">{totalQuestions}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">Waktu</p>
                <p className="font-bold text-foreground text-sm">{quiz.time_limit} mnt</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">Guru</p>
                <p className="font-bold text-foreground text-sm truncate">
                  {quiz.teacher?.name || "-"}
                </p>
              </div>
            </div>

            {/* Petunjuk penting */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-left">
              <p className="text-xs font-semibold text-amber-900 mb-1.5 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Sebelum memulai
              </p>
              <ul className="text-xs text-amber-800 space-y-0.5 ml-5 list-disc">
                <li>Setelah kamu mulai, waktu akan terus berjalan</li>
                <li>Jawaban akan otomatis dinilai oleh AI setelah kamu kumpulkan</li>
                <li>Kamu tidak bisa mengerjakan kuis ini dua kali</li>
              </ul>
            </div>

            {submitError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {submitError}
              </div>
            )}

            <button
              onClick={() => {
                setStarted(true)
                setStartTime(Date.now())
              }}
              className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary/90 transition"
            >
              Mulai Kuis
            </button>
            <button
              onClick={() => router.push("/student/assignments")}
              className="w-full mt-2 text-muted-foreground text-sm py-2 hover:text-foreground transition"
            >
              Kembali ke Tugas
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── State: Quiz active (sedang mengerjakan) ──
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar sticky */}
      <div className="bg-white border-b border-border px-4 lg:px-8 py-3 flex items-center justify-between gap-4 sticky top-0 z-10">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground truncate">{quiz.title}</p>
          <p className="text-xs text-muted-foreground">
            Soal {currentQ + 1} dari {totalQuestions} · {answeredCount} terjawab
          </p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-sm ${
          timeWarning ? "bg-red-50 text-red-600 animate-pulse" : "bg-primary/10 text-primary"
        }`}>
          <Clock className="w-4 h-4" />
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>

      {/* Question area */}
      <div className="flex-1 px-4 lg:px-8 py-6 max-w-3xl w-full mx-auto">
        <div className="bg-white rounded-2xl border border-border p-6 mb-6">
          <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">
            Soal {currentQ + 1} · bobot {Number(currentQuestion.weight)}
          </p>
          <p className="text-foreground text-lg mb-5 leading-relaxed whitespace-pre-wrap">
            {currentQuestion.question_text}
          </p>
          <textarea
            value={answers[currentQuestion.question_id] || ""}
            onChange={(e) =>
              setAnswers((prev) => ({ ...prev, [currentQuestion.question_id]: e.target.value }))
            }
            placeholder="Tulis jawabanmu di sini..."
            rows={8}
            className="w-full px-4 py-3 rounded-xl border border-input bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm resize-none"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {(answers[currentQuestion.question_id] || "").trim().split(/\s+/).filter(Boolean).length} kata
          </p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            onClick={() => setCurrentQ((q) => Math.max(0, q - 1))}
            disabled={currentQ === 0}
            className="px-4 py-2.5 rounded-xl border border-border bg-white text-foreground font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/40 transition"
          >
            <ChevronLeft className="w-4 h-4" /> Sebelumnya
          </button>

          {currentQ < totalQuestions - 1 ? (
            <button
              onClick={() => setCurrentQ((q) => Math.min(totalQuestions - 1, q + 1))}
              className="px-4 py-2.5 rounded-xl bg-primary text-white font-medium text-sm flex items-center gap-2 hover:bg-primary/90 transition"
            >
              Selanjutnya <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              className="px-4 py-2.5 rounded-xl bg-green-600 text-white font-medium text-sm hover:bg-green-700 transition"
            >
              Kumpulkan Jawaban
            </button>
          )}
        </div>

        {/* Question jumper */}
        <div className="bg-white rounded-2xl border border-border p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            Lompat ke soal:
          </p>
          <div className="flex flex-wrap gap-2">
            {quiz.questions.map((q, idx) => {
              const isAnswered = !!(answers[q.question_id] || "").trim()
              const isCurrent = idx === currentQ
              return (
                <button
                  key={q.question_id}
                  onClick={() => setCurrentQ(idx)}
                  className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${
                    isCurrent
                      ? "bg-primary text-white ring-2 ring-primary ring-offset-1"
                      : isAnswered
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>
          <div className="flex gap-3 mt-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-100 border border-green-300" /> Terjawab</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted border border-border" /> Kosong</span>
          </div>
        </div>
      </div>

      {/* Modal konfirmasi submit */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl border border-border p-6 max-w-sm w-full">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <h3 className="font-bold text-foreground mb-2">Kumpulkan jawaban?</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Kamu sudah menjawab <strong>{answeredCount}</strong> dari <strong>{totalQuestions}</strong> soal.
              {answeredCount < totalQuestions && (
                <span className="block mt-1 text-amber-700">
                  Ada {totalQuestions - answeredCount} soal yang belum dijawab.
                </span>
              )}
              <br />
              Setelah dikumpulkan, AI akan menilai jawabanmu dan kamu tidak bisa mengubahnya lagi.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-white text-foreground font-medium text-sm hover:bg-muted/40 transition"
              >
                Lanjutkan Mengerjakan
              </button>
              <button
                onClick={() => { setShowConfirm(false); submitQuiz() }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 text-white font-medium text-sm hover:bg-green-700 transition"
              >
                Ya, Kumpulkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
