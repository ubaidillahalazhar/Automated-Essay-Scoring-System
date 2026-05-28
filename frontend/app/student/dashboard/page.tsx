"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/shared/sidebar"
import {
  BookOpen, Trophy, Clock, TrendingUp, Sparkles, Loader2,
  CheckCircle2, ChevronRight, Target, Award
} from "lucide-react"
import { CompleteProfileModal } from "@/components/shared/CompleteProfileModal"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

const normalizeScore100 = (score: number) => {
  if (!Number.isFinite(score)) return 0
  if (score > 0 && score <= 10) return score * 10
  return score
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
  _count?: { questions: number }
  is_completed: boolean
}

interface AttemptFromDB {
  attempt_token: string
  quiz_id: number
  quiz_title: string
  subject_name: string
  total_score: number
  max_score: number
  completed_at: string
}

export default function StudentDashboard() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [quizzes, setQuizzes] = useState<QuizFromDB[]>([])
  const [attempts, setAttempts] = useState<AttemptFromDB[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "student")) router.replace("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false

    // Capture user.id sebagai local const supaya TypeScript yakin non-null di dalam closure
    const userId = user.id

    async function loadData() {
      setFetching(true)
      try {
        const [quizzesRes, attemptsRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/exams/student/${userId}/available`),
          fetch(`${BACKEND_URL}/api/exams/student/${userId}/attempts`)
        ])
        const quizzesJson = await quizzesRes.json()
        const attemptsJson = await attemptsRes.json()

        if (cancelled) return

        if (quizzesRes.ok) setQuizzes(quizzesJson.data || [])
        if (attemptsRes.ok) setAttempts(attemptsJson.data || [])
      } catch (err) {
        console.error("Gagal memuat dashboard:", err)
      } finally {
        if (!cancelled) setFetching(false)
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [user])

  // ─── EARLY RETURN: TS sekarang yakin user non-null di bawah sini ───
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

  const pendingQuizzes = quizzes.filter(q => !q.is_completed).slice(0, 4)
  const recentAttempts = attempts.slice(0, 3)

  const totalCompleted = attempts.length
  const avgScore = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + normalizeScore100(a.total_score), 0) / attempts.length)
    : 0
  const bestScore = attempts.length
    ? Math.max(...attempts.map(a => Math.round(normalizeScore100(a.total_score))))
    : 0

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:p-8 p-4 pt-16 lg:pt-8 overflow-y-auto">
        <CompleteProfileModal />
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">
            Halo, {user.name.split(" ")[0]}! 👋
          </h1>
          <p className="text-muted-foreground">
            {user.grade_name
              ? `${user.grade_name}${user.school_level ? ` · ${user.school_level}` : ""}`
              : "Selamat datang di dashboard belajarmu."}
          </p>
        </div>

        {fetching ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-2xl border border-border p-4">
                <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground">{totalCompleted}</p>
                <p className="text-xs text-muted-foreground">Kuis Selesai</p>
              </div>
              <div className="bg-white rounded-2xl border border-border p-4">
                <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center mb-3">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                </div>
                <p className="text-2xl font-bold text-foreground">{avgScore}</p>
                <p className="text-xs text-muted-foreground">Rata-rata Nilai</p>
              </div>
              <div className="bg-white rounded-2xl border border-border p-4">
                <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center mb-3">
                  <Award className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-foreground">{bestScore}</p>
                <p className="text-xs text-muted-foreground">Nilai Tertinggi</p>
              </div>
            </div>

            {/* Pending quizzes */}
            <section className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Tugas yang Belum Selesai
                </h2>
                <Link href="/student/assignments" className="text-sm text-primary hover:underline flex items-center gap-1">
                  Lihat semua <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {pendingQuizzes.length === 0 ? (
                <div className="bg-white rounded-2xl border border-border p-8 text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                  <p className="font-semibold text-foreground mb-1">Semua kuis sudah selesai! 🎉</p>
                  <p className="text-sm text-muted-foreground">
                    Belum ada tugas baru untuk saat ini.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {pendingQuizzes.map((quiz) => (
                    <Link
                      key={quiz.quiz_id}
                      href={`/student/quiz/${quiz.quiz_id}`}
                      className="bg-white rounded-2xl border border-border p-4 hover:border-primary/40 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-xs font-semibold text-primary">
                              {quiz.subject?.subject_name || "Mapel"}
                            </p>
                            {quiz.grade?.grade_name && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {quiz.grade.grade_name}
                              </span>
                            )}
                          </div>
                          <p className="font-bold text-foreground line-clamp-1 mb-1">{quiz.title}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {quiz.time_limit} mnt
                            </span>
                            <span>{quiz._count?.questions || 0} soal</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Recent attempts */}
            {recentAttempts.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Nilai Terbaru
                  </h2>
                  <Link href="/student/results" className="text-sm text-primary hover:underline flex items-center gap-1">
                    Lihat semua <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="space-y-2">
                  {recentAttempts.map((a) => {
                    const pct = Math.round(normalizeScore100(a.total_score))
                    const scoreClass = pct >= 80 ? "text-green-700 bg-green-50"
                      : pct >= 60 ? "text-yellow-700 bg-yellow-50"
                      : "text-red-700 bg-red-50"
                    return (
                      <Link
                        key={a.attempt_token}
                        href={`/student/results/${a.attempt_token}`}
                        className="block bg-white rounded-2xl border border-border p-4 hover:border-primary/40 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground truncate">{a.quiz_title}</p>
                            <p className="text-xs text-muted-foreground">
                              {a.subject_name} · {new Date(a.completed_at).toLocaleDateString("id-ID", {
                                day: "numeric", month: "short"
                              })}
                            </p>
                          </div>
                          <div className={`text-center px-3 py-1.5 rounded-xl ${scoreClass} flex-shrink-0`}>
                            <p className="text-xl font-bold leading-none">{pct}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
