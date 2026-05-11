"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/shared/sidebar"
import { getStoredAttempts, type QuizAttempt } from "@/lib/store"
import { Trophy, Clock, ChevronRight, TrendingUp, Award } from "lucide-react"

export default function StudentResults() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "student")) router.replace("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    if (!user) return
    const all = getStoredAttempts()
    setAttempts(all.filter((a) => a.studentId === user.id))
  }, [user])

  if (isLoading || !user) return null

  const avgScore = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + (a.totalScore / a.maxScore) * 100, 0) / attempts.length)
    : 0
  const best = attempts.length
    ? Math.max(...attempts.map((a) => Math.round((a.totalScore / a.maxScore) * 100)))
    : 0

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:p-8 p-4 pt-16 lg:pt-8 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Nilai Saya</h1>
          <p className="text-muted-foreground">Riwayat lengkap semua kuis yang telah kamu selesaikan.</p>
        </div>

        {/* Summary cards */}
        {attempts.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
                <Trophy className="w-4.5 h-4.5 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">{attempts.length}</p>
              <p className="text-xs text-muted-foreground">Kuis Selesai</p>
            </div>
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center mb-3">
                <TrendingUp className="w-4.5 h-4.5 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-foreground">{avgScore}</p>
              <p className="text-xs text-muted-foreground">Rata-rata Nilai</p>
            </div>
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center mb-3">
                <Award className="w-4.5 h-4.5 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-foreground">{best}</p>
              <p className="text-xs text-muted-foreground">Nilai Tertinggi</p>
            </div>
          </div>
        )}

        {/* Attempts list */}
        <div className="space-y-3">
          {attempts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border p-12 text-center">
              <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground mb-1">Belum ada nilai</p>
              <p className="text-sm text-muted-foreground mb-4">Selesaikan kuis pertamamu untuk melihat nilaimu di sini.</p>
              <Link href="/student/assignments" className="inline-block px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors">
                Lihat Tugas
              </Link>
            </div>
          ) : (
            attempts.map((attempt) => {
              const pct = Math.round((attempt.totalScore / attempt.maxScore) * 100)
              const color = pct >= 80 ? { bg: "bg-green-50", text: "text-green-700", bar: "bg-green-500" }
                : pct >= 60 ? { bg: "bg-yellow-50", text: "text-yellow-700", bar: "bg-yellow-500" }
                : { bg: "bg-red-50", text: "text-red-700", bar: "bg-red-500" }
              const timeMins = Math.floor(attempt.timeTaken / 60)
              const timeSecs = attempt.timeTaken % 60
              return (
                <Link
                  key={attempt.id}
                  href={`/student/results/${attempt.id}`}
                  className="bg-white rounded-2xl border border-border p-5 flex items-center gap-4 hover:shadow-sm hover:border-primary/20 transition-all group block"
                >
                  <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 ${color.bg}`}>
                    <span className={`text-xl font-bold leading-none ${color.text}`}>{pct}</span>
                    <span className={`text-xs ${color.text}`}>/ 100</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground mb-1 truncate">{attempt.quizTitle}</h3>
                    <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                      <div className={`h-1.5 rounded-full transition-all ${color.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{new Date(attempt.completedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeMins}m {timeSecs}s
                      </span>
                      <span>{attempt.totalScore}/{attempt.maxScore} poin</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </Link>
              )
            })
          )}
        </div>
      </main>
    </div>
  )
}
