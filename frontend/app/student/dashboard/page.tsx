"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/shared/sidebar"
import {
  BookOpen, Trophy, ClipboardList, Loader2, TrendingUp, X
} from "lucide-react"
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, LabelList, XAxis, YAxis, CartesianGrid, Tooltip
} from "recharts"
import { CompleteProfileModal } from "@/components/shared/CompleteProfileModal"
import { ChatbotWidget } from "@/components/shared/ChatbotWidget"
import { apiFetch } from "@/lib/api"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

const ALL_SUBJECTS = "__all__"

const normalizeScore100 = (score: number) => {
  if (!Number.isFinite(score)) return 0
  if (score > 0 && score <= 10) return score * 10
  return score
}

interface AttemptFromDB {
  attempt_token: string
  quiz_id: number
  quiz_title: string
  subject_name: string
  // null selama guru belum menyetujui hasil penilaian AI
  total_score: number | null
  max_score: number
  is_approved: boolean
  completed_at: string
  // null selama guru belum menyetujui hasil penilaian AI
  approved_at: string | null
}

interface AvailableQuizFromDB {
  quiz_id: number
  is_completed: boolean
}

export default function StudentDashboard() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [attempts, setAttempts] = useState<AttemptFromDB[]>([])
  const [availableQuizzes, setAvailableQuizzes] = useState<AvailableQuizFromDB[]>([])
  const [fetching, setFetching] = useState(true)
  const [selectedSubject, setSelectedSubject] = useState<string | null>(ALL_SUBJECTS)

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
        const [attemptsRes, availableRes] = await Promise.all([
          apiFetch(`/api/exams/student/${userId}/attempts`),
          apiFetch(`/api/exams/student/${userId}/available`),
        ])
        const attemptsJson = await attemptsRes.json()
        const availableJson = await availableRes.json()

        if (cancelled) return

        if (attemptsRes.ok) setAttempts(attemptsJson.data || [])
        if (availableRes.ok) setAvailableQuizzes(availableJson.data || [])
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

  const totalCompleted = attempts.length
  const pendingTasksCount = availableQuizzes.filter((q) => !q.is_completed).length

  // Backend mengirim total_score = null selama guru belum menyetujui hasil AI.
  // Nilai null HARUS dikeluarkan dari perhitungan — kalau ikut dihitung,
  // normalizeScore100(null) menghasilkan 0 dan rata-rata jadi turun tanpa sebab.
  const scoredAttempts = attempts.filter(
    (a): a is AttemptFromDB & { total_score: number } => a.total_score !== null
  )
  const avgScore = scoredAttempts.length
    ? Math.round(
        scoredAttempts.reduce((s, a) => s + normalizeScore100(a.total_score), 0) / scoredAttempts.length
      )
    : 0

  // Performa per mata pelajaran
  const subjectStatsMap = new Map<string, { total: number; count: number }>()
  for (const a of scoredAttempts) {
    const subj = a.subject_name || "Lainnya"
    const existing = subjectStatsMap.get(subj) || { total: 0, count: 0 }
    subjectStatsMap.set(subj, {
      total: existing.total + normalizeScore100(a.total_score),
      count: existing.count + 1
    })
  }
  const subjectStats = Array.from(subjectStatsMap.entries())
    .map(([subject_name, val]) => ({
      subject_name,
      avgScore: Math.round(val.total / val.count),
      count: val.count
    }))
    .sort((a, b) => b.avgScore - a.avgScore)

  // Data grafik garis untuk mata pelajaran yang dipilih: sumbu-x selalu tanggal 1
  // s.d. hari terakhir BULAN INI, nilai ditempatkan sesuai tanggal approval guru.
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const currentMonthLabel = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })

  const selectedSubjectHistory = selectedSubject && selectedSubject !== ALL_SUBJECTS
    ? (() => {
        const byDay = new Map<number, { total: number; count: number; titles: string[] }>()
        for (const a of scoredAttempts) {
          if ((a.subject_name || "Lainnya") !== selectedSubject) continue
          if (!a.approved_at) continue
          const approvedDate = new Date(a.approved_at)
          if (approvedDate.getFullYear() !== currentYear || approvedDate.getMonth() !== currentMonth) continue

          const day = approvedDate.getDate()
          const entry = byDay.get(day) || { total: 0, count: 0, titles: [] }
          entry.total += normalizeScore100(a.total_score)
          entry.count += 1
          entry.titles.push(a.quiz_title)
          byDay.set(day, entry)
        }

        return Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const entry = byDay.get(day)
          return {
            day,
            score: entry ? Math.round(entry.total / entry.count) : null,
            quiz_title: entry ? entry.titles.join(", ") : ""
          }
        })
      })()
    : []
  const hasSubjectHistoryData = selectedSubjectHistory.some((d) => d.score !== null)

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
              <Link
                href="/student/results"
                className="bg-white rounded-2xl border border-border p-4 block transition-colors hover:border-primary/40"
              >
                <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground">{totalCompleted}</p>
                <p className="text-xs text-muted-foreground">Kuis Selesai</p>
              </Link>
              <Link
                href="/student/assignments"
                className="bg-white rounded-2xl border border-border p-4 block transition-colors hover:border-primary/40"
              >
                <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center mb-3">
                  <ClipboardList className="w-5 h-5 text-amber-600" />
                </div>
                <p className="text-2xl font-bold text-foreground">{pendingTasksCount}</p>
                <p className="text-xs text-muted-foreground">Tugas Saya</p>
              </Link>
              <div className="bg-white rounded-2xl border border-border p-4">
                <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center mb-3">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-foreground">{avgScore}</p>
                <p className="text-xs text-muted-foreground">Rata-rata Nilai</p>
              </div>
            </div>

            {/* Performa per mata pelajaran */}
            {subjectStats.length > 0 && (
              <div className="bg-white rounded-2xl border border-border p-5 mb-6">
                <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" /> Performa per Mata Pelajaran
                </h3>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setSelectedSubject(selectedSubject === ALL_SUBJECTS ? null : ALL_SUBJECTS)}
                    className={`w-full text-left rounded-xl p-2 -m-2 transition-colors flex items-center justify-between ${
                      selectedSubject === ALL_SUBJECTS ? "bg-primary/5" : "hover:bg-muted/60"
                    }`}
                  >
                    <span className={`text-sm font-semibold ${selectedSubject === ALL_SUBJECTS ? "text-primary" : "text-foreground"}`}>
                      Semua Mata Pelajaran
                    </span>
                    <span className="text-xs text-muted-foreground">{subjectStats.length} mapel</span>
                  </button>

                  {subjectStats.map((s) => {
                    const isActive = selectedSubject === s.subject_name
                    return (
                      <button
                        key={s.subject_name}
                        type="button"
                        onClick={() => setSelectedSubject(isActive ? null : s.subject_name)}
                        className={`w-full text-left rounded-xl p-2 -m-2 transition-colors ${
                          isActive ? "bg-primary/5" : "hover:bg-muted/60"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-semibold ${isActive ? "text-primary" : "text-foreground"}`}>
                            {s.subject_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {s.count} kuis · rata-rata {s.avgScore}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              s.avgScore >= 80 ? "bg-green-500" :
                              s.avgScore >= 60 ? "bg-yellow-500" : "bg-red-500"
                            }`}
                            style={{ width: `${s.avgScore}%` }}
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>

                {selectedSubject && (
                  <div className="mt-5 pt-5 border-t border-border">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-foreground">
                        {selectedSubject === ALL_SUBJECTS
                          ? "Persentase Nilai per Mata Pelajaran"
                          : `Perkembangan Nilai · ${selectedSubject} (${currentMonthLabel})`}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedSubject(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {selectedSubject === ALL_SUBJECTS ? (
                      <div style={{ width: "100%", height: 240 }}>
                        <ResponsiveContainer>
                          <BarChart data={subjectStats} margin={{ top: 24, right: 12, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="subject_name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <Tooltip
                              formatter={(value: number) => [`${value}%`, "Rata-rata"]}
                              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                            />
                            <Bar dataKey="avgScore" fill="#f5a623" radius={[6, 6, 0, 0]}>
                              <LabelList
                                dataKey="avgScore"
                                position="top"
                                formatter={(value: number) => `${value}%`}
                                style={{ fontSize: 11, fontWeight: 600, fill: "#374151" }}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : !hasSubjectHistoryData ? (
                      <p className="text-sm text-muted-foreground">
                        Belum ada nilai yang disetujui guru bulan ini untuk mata pelajaran ini.
                      </p>
                    ) : (
                      <div style={{ width: "100%", height: 220 }}>
                        <ResponsiveContainer>
                          <LineChart data={selectedSubjectHistory} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis
                              dataKey="day"
                              interval={0}
                              tick={{ fontSize: 9, fill: "#6b7280" }}
                              axisLine={{ stroke: "#e5e7eb" }}
                              tickLine={false}
                            />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <Tooltip
                              formatter={(value) =>
                                (value === null || value === undefined) ? "Belum ada nilai" : [`${value}`, "Nilai"]
                              }
                              labelFormatter={(label, payload) => {
                                const title = payload?.[0]?.payload?.quiz_title
                                return title ? `Tanggal ${label} · ${title}` : `Tanggal ${label}`
                              }}
                              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                            />
                            <Line
                              type="monotone"
                              dataKey="score"
                              stroke="#f5a623"
                              strokeWidth={2}
                              dot={{ r: 4, fill: "#f5a623" }}
                              activeDot={{ r: 6 }}
                              connectNulls={true}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <ChatbotWidget />
    </div>
  )
}