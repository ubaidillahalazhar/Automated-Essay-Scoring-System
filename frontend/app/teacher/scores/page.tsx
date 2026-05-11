"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/shared/sidebar"
import { getStoredQuizzes, getStoredAttempts, saveAttempts, type QuizAttempt } from "@/lib/store"
import { Search, ChevronRight, CheckCircle2, Clock, Filter } from "lucide-react"

export default function TeacherScores() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [search, setSearch] = useState("")
  const [filterQuiz, setFilterQuiz] = useState("all")
  const [quizOptions, setQuizOptions] = useState<{ id: string; title: string }[]>([])
  const [editingScore, setEditingScore] = useState<{ id: string; qi: number; value: number } | null>(null)

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "teacher")) router.replace("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    if (!user) return
    const quizzes = getStoredQuizzes().filter((q) => q.teacherId === user.id)
    const myQuizIds = new Set(quizzes.map((q) => q.id))
    const all = getStoredAttempts()
    const mine = all.filter((a) => myQuizIds.has(a.quizId))
    setAttempts(mine)
    setQuizOptions(quizzes.map((q) => ({ id: q.id, title: q.title })))
  }, [user])

  function saveManualScore(attemptId: string, questionIdx: number, newScore: number) {
    const allAttempts = getStoredAttempts()
    const updated = allAttempts.map((a) => {
      if (a.id !== attemptId) return a
      const answers = [...a.answers]
      const maxPoints = answers[questionIdx] ? newScore : 0
      answers[questionIdx] = { ...answers[questionIdx], score: newScore }
      const totalScore = answers.reduce((s, ans) => s + (ans.score || 0), 0)
      return { ...a, answers, totalScore }
    })
    saveAttempts(updated)
    const myQuizIds = new Set(getStoredQuizzes().filter((q) => q.teacherId === user?.id).map((q) => q.id))
    setAttempts(updated.filter((a) => myQuizIds.has(a.quizId)))
    setEditingScore(null)
  }

  if (isLoading || !user) return null

  const filtered = attempts.filter((a) => {
    const matchSearch = a.studentName.toLowerCase().includes(search.toLowerCase()) ||
      a.quizTitle.toLowerCase().includes(search.toLowerCase())
    const matchQuiz = filterQuiz === "all" || a.quizId === filterQuiz
    return matchSearch && matchQuiz
  })

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:p-8 p-4 pt-16 lg:pt-8 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Nilai Siswa</h1>
          <p className="text-muted-foreground">Pantau dan koreksi nilai semua siswa.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama siswa atau kuis..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm"
            />
          </div>
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select
              value={filterQuiz}
              onChange={(e) => setFilterQuiz(e.target.value)}
              className="pl-9 pr-8 py-2.5 rounded-xl border border-input bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition text-sm appearance-none"
            >
              <option value="all">Semua Kuis</option>
              {quizOptions.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-semibold text-foreground mb-1">Tidak ada data</p>
              <p className="text-sm text-muted-foreground">Belum ada siswa yang mengumpulkan kuis.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Siswa</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kuis</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Waktu</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nilai</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Tanggal</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((attempt) => {
                    const pct = Math.round((attempt.totalScore / attempt.maxScore) * 100)
                    const color = pct >= 80 ? "text-green-600 bg-green-50" : pct >= 60 ? "text-yellow-600 bg-yellow-50" : "text-red-600 bg-red-50"
                    const timeMins = Math.floor(attempt.timeTaken / 60)
                    return (
                      <tr key={attempt.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {attempt.studentName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{attempt.studentName}</p>
                              <p className="text-xs text-muted-foreground">{attempt.studentClass}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-foreground truncate max-w-[150px]">{attempt.quizTitle}</p>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" /> {timeMins} mnt
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${color}`}>{pct}</span>
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell text-muted-foreground text-xs">
                          {new Date(attempt.completedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3.5">
                          <Link
                            href={`/student/results/${attempt.id}`}
                            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            Detail <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-3 text-right">{filtered.length} pengumpulan ditemukan</p>
      </main>
    </div>
  )
}
