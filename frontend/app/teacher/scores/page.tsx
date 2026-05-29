"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/shared/sidebar"
import {
  Search, ChevronRight, Clock, AlertCircle, Loader2, Users,
  ShieldCheck, Hourglass
} from "lucide-react"
import { apiFetch } from "@/lib/api"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface AttemptFromDB {
  attempt_token: string
  quiz_id: number
  quiz_title: string
  subject_name: string
  grade_name: string
  student_id: number
  student_name: string
  student_class: string
  answer_count: number
  total_score: number
  max_score: number
  is_approved: boolean
  completed_at: string
}

interface QuizOption {
  quiz_id: number
  title: string
}

export default function TeacherScores() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [attempts, setAttempts] = useState<AttemptFromDB[]>([])
  const [quizOptions, setQuizOptions] = useState<QuizOption[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string>("")
  const [search, setSearch] = useState("")
  const [filterQuiz, setFilterQuiz] = useState("all")
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved">("all")

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "teacher")) router.replace("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const userId = user.id

    async function fetchAttempts() {
      setFetching(true)
      setError("")
      try {
        const res = await apiFetch(`/api/exams/teacher/${userId}/attempts`)
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(json.message || "Gagal mengambil data nilai.")
          setAttempts([])
        } else {
          setAttempts(json.data || [])
          setQuizOptions(json.quizzes || [])
        }
      } catch (err) {
        if (!cancelled) {
          setError("Tidak dapat menghubungi server.")
          setAttempts([])
        }
      } finally {
        if (!cancelled) setFetching(false)
      }
    }

    fetchAttempts()
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

  const filtered = attempts.filter((a) => {
    if (filterQuiz !== "all" && a.quiz_id !== parseInt(filterQuiz)) return false
    if (filterStatus === "pending" && a.is_approved) return false
    if (filterStatus === "approved" && !a.is_approved) return false
    if (search) {
      const q = search.toLowerCase()
      if (!a.student_name.toLowerCase().includes(q) &&
          !a.quiz_title.toLowerCase().includes(q)) return false
    }
    return true
  })

  const totalAttempts = attempts.length
  const pendingCount = attempts.filter(a => !a.is_approved).length
  const approvedCount = attempts.filter(a => a.is_approved).length

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:p-8 p-4 pt-16 lg:pt-8 overflow-y-auto">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Nilai Siswa</h1>
          <p className="text-muted-foreground">
            Koreksi dan setujui nilai sebelum siswa dapat melihatnya.
          </p>
        </div>

        {/* Summary cards */}
        {!fetching && totalAttempts > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">{totalAttempts}</p>
              <p className="text-xs text-muted-foreground">Total Pengerjaan</p>
            </div>
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center mb-3">
                <Hourglass className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Menunggu Koreksi</p>
            </div>
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center mb-3">
                <ShieldCheck className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
              <p className="text-xs text-muted-foreground">Sudah Disetujui</p>
            </div>
          </div>
        )}

        {/* Filter status pills */}
        <div className="flex gap-2 mb-4">
          {([
            { id: "all", label: "Semua" },
            { id: "pending", label: "Menunggu Koreksi" },
            { id: "approved", label: "Sudah Disetujui" },
          ] as const).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterStatus(f.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterStatus === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-white border border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search + quiz filter */}
        <div className="bg-white rounded-2xl border border-border p-4 mb-6 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama siswa atau judul kuis..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <select
            value={filterQuiz} onChange={(e) => setFilterQuiz(e.target.value)}
            className="px-3 py-2 rounded-xl border border-input bg-white text-sm font-medium"
          >
            <option value="all">Semua Kuis</option>
            {quizOptions.map(q => (
              <option key={q.quiz_id} value={q.quiz_id}>{q.title}</option>
            ))}
          </select>
        </div>

        {/* Content */}
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
            <Users className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-semibold text-foreground mb-1">
              {attempts.length === 0 ? "Belum ada siswa yang mengerjakan kuis" : "Tidak ada hasil yang cocok"}
            </p>
            <p className="text-sm text-muted-foreground">
              {attempts.length === 0
                ? "Tunggu siswa mengerjakan kuis Anda."
                : "Coba ubah filter atau kata kunci pencarian."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((attempt) => {
              const pct = Math.round(attempt.total_score)
              const scoreClass = pct >= 80
                ? "text-green-700 bg-green-50 border-green-100"
                : pct >= 60
                ? "text-yellow-700 bg-yellow-50 border-yellow-100"
                : "text-red-700 bg-red-50 border-red-100"

              return (
                <Link
                  key={attempt.attempt_token}
                  href={`/student/results/${attempt.attempt_token}`}
                  className="block bg-white rounded-2xl border border-border p-4 hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-primary">
                        {attempt.student_name.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="font-semibold text-foreground truncate">{attempt.student_name}</p>
                        {attempt.student_class && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {attempt.student_class}
                          </span>
                        )}
                        {/* Badge status koreksi */}
                        {attempt.is_approved ? (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                            <ShieldCheck className="w-2.5 h-2.5" /> Disetujui
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                            <Hourglass className="w-2.5 h-2.5" /> Perlu dikoreksi
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {attempt.quiz_title} · {attempt.subject_name || "-"}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(attempt.completed_at).toLocaleDateString("id-ID", {
                            day: "numeric", month: "short", year: "numeric"
                          })}
                        </span>
                        <span>{attempt.answer_count} jawaban</span>
                      </div>
                    </div>

                    <div className={`text-center px-3 py-2 rounded-xl border ${scoreClass} flex-shrink-0`}>
                      <p className="text-2xl font-bold leading-none">{pct}</p>
                      <p className="text-[10px] font-medium mt-1">/100</p>
                    </div>

                    <ChevronRight className="w-5 h-5 text-muted-foreground/40 flex-shrink-0" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
