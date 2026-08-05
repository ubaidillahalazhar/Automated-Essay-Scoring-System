"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/shared/sidebar"
import { Clock, BookOpen, CheckCircle2, AlertCircle, Circle, Loader2, XCircle } from "lucide-react"
import { apiFetch } from "@/lib/api"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface QuizFromDB {
  quiz_id: number
  title: string
  description: string | null
  time_limit: number
  due_date: string
  teacher?: { name: string } | null
  subject?: { subject_name: string } | null
  grade?: { grade_name: string; school_level: string } | null
  _count?: { questions: number }
  is_completed: boolean
}

interface StudentInfo {
  grade_id: number
  grade_name: string
  school_level: string
}

// Helper: tentukan status quiz
type QuizStatus = "pending" | "done" | "overdue"

function getQuizStatus(quiz: QuizFromDB): QuizStatus {
  if (quiz.is_completed) return "done"          // sudah dikerjakan → hijau
  const isPastDue = new Date(quiz.due_date) < new Date()
  if (isPastDue) return "overdue"               // lewat tanpa dikerjakan → merah
  return "pending"                              // aktif, belum dikerjakan
}

export default function StudentAssignments() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [quizzes, setQuizzes] = useState<QuizFromDB[]>([])
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string>("")
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all")
  const [gradeFilter, setGradeFilter] = useState<string>("all")

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "student")) router.replace("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const userId = user.id

    async function fetchAvailable() {
      setFetching(true)
      setError("")
      try {
        const res = await apiFetch(`${BACKEND_URL}/api/exams/student/${userId}/available`)
        const json = await res.json()
        if (cancelled) return

        if (!res.ok) {
          setError(json.message || "Gagal mengambil daftar tugas.")
          setQuizzes([])
        } else {
          setQuizzes(json.data || [])
          setStudentInfo(json.student_info || null)
        }
      } catch (err) {
        if (!cancelled) {
          setError("Tidak dapat menghubungi server. Coba lagi sebentar.")
          setQuizzes([])
        }
      } finally {
        if (!cancelled) setFetching(false)
      }
    }

    fetchAvailable()
    return () => { cancelled = true }
  }, [user])

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </main>
      </div>
    )
  }

  // Daftar grade unik untuk dropdown
  const availableGrades = Array.from(
    new Set(quizzes.map(q => q.grade?.grade_name).filter(Boolean) as string[])
  ).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, "")) || 0
    const numB = parseInt(b.replace(/\D/g, "")) || 0
    return numA - numB
  })

  // Filter: tab "Tertunda" = pending saja, "Selesai" = done + overdue
  const filtered = quizzes.filter((q) => {
    const status = getQuizStatus(q)
    if (filter === "pending" && status !== "pending") return false
    if (filter === "completed" && status === "pending") return false  // selesai = done OR overdue
    if (gradeFilter !== "all" && q.grade?.grade_name !== gradeFilter) return false
    return true
  })

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:p-8 p-4 pt-16 lg:pt-8 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Tugas Saya</h1>
          <p className="text-muted-foreground">
            {studentInfo
              ? `Daftar kuis untuk jenjang ${studentInfo.school_level} (kamu di ${studentInfo.grade_name}).`
              : "Daftar kuis yang tersedia untukmu."}
          </p>
        </div>

        {/* Filter tabs + grade dropdown */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(["all", "pending", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-white border border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              {f === "all" ? "Semua" : f === "pending" ? "Tertunda" : "Selesai"}
            </button>
          ))}
          {availableGrades.length > 1 && (
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="ml-auto px-3 py-2 rounded-lg border border-border bg-white text-sm font-medium text-foreground"
            >
              <option value="all">Semua Kelas</option>
              {availableGrades.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          )}
        </div>

        {fetching ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="font-semibold text-red-700">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border p-10 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-semibold text-foreground mb-1">Belum ada kuis</p>
            <p className="text-sm text-muted-foreground">
              {!studentInfo
                ? "Kamu belum punya kelas. Hubungi admin untuk mengatur kelasmu."
                : filter === "pending"
                ? "Tidak ada kuis aktif. Semua sudah selesai atau lewat batas waktu."
                : filter === "completed"
                ? "Belum ada kuis yang sudah dikerjakan atau lewat batas waktu."
                : `Belum ada kuis untuk jenjang ${studentInfo.school_level} saat ini.`}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((quiz) => {
              const status = getQuizStatus(quiz)
              const dueDate = new Date(quiz.due_date)

              // Style per status
              const cardClass =
                status === "done"
                  ? "bg-green-50/50 border-green-200"
                  : status === "overdue"
                  ? "bg-red-50/50 border-red-200"
                  : "bg-white border-border hover:border-primary/40 hover:shadow-sm"

              return (
                <div
                  key={quiz.quiz_id}
                  className={`rounded-2xl border p-5 transition-all flex flex-col ${cardClass}`}
                >
                  {/* Header: ikon kiri + badge status kanan */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      status === "done"
                        ? "bg-green-100"
                        : status === "overdue"
                        ? "bg-red-100"
                        : "bg-primary/10"
                    }`}>
                      <BookOpen className={`w-5 h-5 ${
                        status === "done"
                          ? "text-green-700"
                          : status === "overdue"
                          ? "text-red-700"
                          : "text-primary"
                      }`} />
                    </div>

                    {status === "done" ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                      </span>
                    ) : status === "overdue" ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
                        <XCircle className="w-3.5 h-3.5" /> Terlewat
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
                        <Circle className="w-3.5 h-3.5" /> Tertunda
                      </span>
                    )}
                  </div>

                  {/* Info quiz */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-semibold text-primary">
                        {quiz.subject?.subject_name || "Mata Pelajaran"}
                      </p>
                      {quiz.grade?.grade_name && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {quiz.grade.grade_name}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-foreground mb-1 line-clamp-2">{quiz.title}</h3>
                    {quiz.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{quiz.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      oleh {quiz.teacher?.name || "Guru"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {quiz.time_limit} menit
                    </span>
                    <span>{quiz._count?.questions || 0} soal</span>
                  </div>

                  <div className="flex items-center justify-between text-xs mb-4">
                    <span className={`font-medium ${
                      status === "overdue" ? "text-red-700" :
                      status === "done" ? "text-green-700" :
                      "text-muted-foreground"
                    }`}>
                      Tenggat: {dueDate.toLocaleDateString("id-ID", {
                        day: "numeric", month: "short", year: "numeric"
                      })}
                    </span>
                  </div>

                  {/* Tombol aksi sesuai status */}
                  {status === "done" ? (
                    <Link
                      href={`/student/results`}
                      className="mt-auto w-full py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold text-center hover:bg-green-700 transition-colors"
                    >
                      Lihat Nilai
                    </Link>
                  ) : status === "overdue" ? (
                    <button
                      disabled
                      className="mt-auto w-full py-2.5 rounded-xl bg-red-100 text-red-700 text-sm font-semibold text-center cursor-not-allowed border border-red-200"
                    >
                      Sudah Terlewat
                    </button>
                  ) : (
                    <Link
                      href={`/student/quiz/${quiz.quiz_id}`}
                      className="mt-auto w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold text-center hover:bg-primary/90 transition-colors"
                    >
                      Mulai Kuis
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
