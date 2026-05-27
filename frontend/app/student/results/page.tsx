"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/shared/sidebar"
import {
  Trophy, ChevronRight, TrendingUp, Award, Clock,
  Loader2, AlertCircle, BookOpen
} from "lucide-react"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

// ─────────────────────────────────────────────────────────────────────
// Tipe data dari GET /api/exams/student/:id/attempts
// ─────────────────────────────────────────────────────────────────────
interface AttemptFromDB {
  attempt_token: string
  quiz_id: number
  quiz_title: string
  subject_name: string
  grade_name: string
  answer_count: number
  total_score: number
  max_score: number
  completed_at: string
}

export default function StudentResultsList() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [attempts, setAttempts] = useState<AttemptFromDB[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "student")) router.replace("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false

    // Capture user.id sebagai local const supaya TypeScript yakin non-null
    const userId = user.id

    async function fetchAttempts() {
      setFetching(true)
      setError("")
      try {
        const res = await fetch(`${BACKEND_URL}/api/exams/student/${userId}/attempts`)
        const json = await res.json()
        if (cancelled) return

        if (!res.ok) {
          setError(json.message || "Gagal mengambil daftar nilai.")
          setAttempts([])
        } else {
          setAttempts(json.data || [])
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

  // Statistik
  const avgScore = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + a.total_score, 0) / attempts.length)
    : 0
  const bestScore = attempts.length
    ? Math.max(...attempts.map(a => Math.round(a.total_score)))
    : 0

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:p-8 p-4 pt-16 lg:pt-8 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Nilai Saya</h1>
          <p className="text-muted-foreground">
            Riwayat lengkap semua kuis yang telah kamu selesaikan.
          </p>
        </div>

        {/* Stat cards — hanya tampil kalau ada attempt */}
        {!fetching && attempts.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">{attempts.length}</p>
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
        )}

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
        ) : attempts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border p-10 text-center">
            <Trophy className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-semibold text-foreground mb-1">Belum ada nilai</p>
            <p className="text-sm text-muted-foreground mb-5">
              Selesaikan kuis pertamamu untuk melihat nilaimu di sini.
            </p>
            <Link
              href="/student/assignments"
              className="inline-block px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition"
            >
              Lihat Tugas
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {attempts.map((a) => {
              const pct = Math.round(a.total_score)
              const scoreClass = pct >= 80
                ? "text-green-700 bg-green-50 border-green-100"
                : pct >= 60
                ? "text-yellow-700 bg-yellow-50 border-yellow-100"
                : "text-red-700 bg-red-50 border-red-100"

              return (
                <Link
                  key={a.attempt_token}
                  href={`/student/results/${a.attempt_token}`}
                  className="block bg-white rounded-2xl border border-border p-4 hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-semibold text-primary">
                          {a.subject_name || "Mata Pelajaran"}
                        </p>
                        {a.grade_name && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {a.grade_name}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-foreground truncate mb-1">{a.quiz_title}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(a.completed_at).toLocaleDateString("id-ID", {
                            day: "numeric", month: "short", year: "numeric"
                          })}
                        </span>
                        <span>{a.answer_count} jawaban</span>
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
