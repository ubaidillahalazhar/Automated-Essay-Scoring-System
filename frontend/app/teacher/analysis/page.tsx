"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/shared/sidebar"
import { getStoredQuizzes, getStoredAttempts, saveAttempts, type Quiz, type QuizAttempt } from "@/lib/store"
import { Sparkles, TrendingUp, TrendingDown, Minus, Users, BarChart2, ChevronDown, RefreshCw } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"

function generateAIAnalysis(attempt: QuizAttempt, quiz: Quiz | undefined): string {
  const pct = Math.round((attempt.totalScore / attempt.maxScore) * 100)
  const correctCount = attempt.answers.filter((a) => a.isCorrect).length
  const total = attempt.answers.length
  const name = attempt.studentName.split(" ")[0]

  if (pct >= 90) return `${name} menunjukkan penguasaan materi yang luar biasa dengan skor ${pct}. Menjawab ${correctCount} dari ${total} soal dengan benar. Disarankan untuk mengambil materi pengayaan atau membantu teman sebaya.`
  if (pct >= 75) return `${name} memiliki pemahaman yang baik terhadap materi dengan skor ${pct}. ${correctCount}/${total} soal dijawab benar. Beberapa konsep perlu diperdalam, khususnya pada soal-soal yang belum terjawab dengan lengkap.`
  if (pct >= 60) return `${name} memiliki pemahaman dasar yang cukup (skor ${pct}). Sebanyak ${correctCount}/${total} soal terjawab benar. Disarankan untuk meninjau ulang materi dan berlatih lebih banyak soal.`
  return `${name} perlu perhatian lebih dengan skor ${pct}. Hanya ${correctCount}/${total} soal yang dijawab benar. Sangat disarankan untuk mengikuti bimbingan belajar tambahan dan mempelajari ulang konsep dasar.`
}

function generateClassSummary(attempts: QuizAttempt[], quizTitle: string): string {
  if (attempts.length === 0) return ""
  const scores = attempts.map((a) => Math.round((a.totalScore / a.maxScore) * 100))
  const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
  const high = scores.filter((s) => s >= 80).length
  const low = scores.filter((s) => s < 60).length
  const passing = scores.filter((s) => s >= 70).length

  return `Analisis kelas untuk kuis "${quizTitle}": Rata-rata nilai kelas adalah ${avg} dari ${attempts.length} siswa yang mengumpulkan. Sebanyak ${high} siswa (${Math.round((high / attempts.length) * 100)}%) mencapai nilai di atas 80, ${passing} siswa (${Math.round((passing / attempts.length) * 100)}%) mencapai nilai kelulusan (≥70), dan ${low} siswa (${Math.round((low / attempts.length) * 100)}%) masih memerlukan perhatian khusus dengan nilai di bawah 60. ${avg >= 75 ? "Secara keseluruhan, pemahaman kelas terhadap materi ini cukup baik." : avg >= 60 ? "Kelas memerlukan reinforcement pada beberapa topik utama." : "Kelas secara umum memerlukan remedial dan perlu pendekatan pengajaran yang berbeda."}`
}

export default function TeacherAnalysis() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [allAttempts, setAllAttempts] = useState<QuizAttempt[]>([])
  const [selectedQuiz, setSelectedQuiz] = useState<string>("all")
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set())
  const [analyzingClass, setAnalyzingClass] = useState(false)
  const [classSummary, setClassSummary] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "teacher")) router.replace("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    if (!user) return
    const myQuizzes = getStoredQuizzes().filter((q) => q.teacherId === user.id)
    const myQuizIds = new Set(myQuizzes.map((q) => q.id))
    const attempts = getStoredAttempts().filter((a) => myQuizIds.has(a.quizId))
    setQuizzes(myQuizzes)
    setAllAttempts(attempts)
  }, [user])

  const filteredAttempts = selectedQuiz === "all"
    ? allAttempts
    : allAttempts.filter((a) => a.quizId === selectedQuiz)

  const scores = filteredAttempts.map((a) => Math.round((a.totalScore / a.maxScore) * 100))
  const avg = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0
  const highest = scores.length ? Math.max(...scores) : 0
  const lowest = scores.length ? Math.min(...scores) : 0
  const passing = scores.filter((s) => s >= 70).length

  const distribution = [
    { range: "0-59", count: scores.filter((s) => s < 60).length, color: "#ef4444" },
    { range: "60-69", count: scores.filter((s) => s >= 60 && s < 70).length, color: "#f97316" },
    { range: "70-79", count: scores.filter((s) => s >= 70 && s < 80).length, color: "#eab308" },
    { range: "80-89", count: scores.filter((s) => s >= 80 && s < 90).length, color: "#84cc16" },
    { range: "90-100", count: scores.filter((s) => s >= 90).length, color: "#22c55e" },
  ]

  async function analyzeStudent(attempt: QuizAttempt) {
    setAnalyzingIds((prev) => new Set([...prev, attempt.id]))
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800))
    const quiz = quizzes.find((q) => q.id === attempt.quizId)
    const analysis = generateAIAnalysis(attempt, quiz)
    const allAttemptsCopy = getStoredAttempts()
    const updated = allAttemptsCopy.map((a) => a.id === attempt.id ? { ...a, aiAnalysis: analysis } : a)
    saveAttempts(updated)
    setAllAttempts((prev) => prev.map((a) => a.id === attempt.id ? { ...a, aiAnalysis: analysis } : a))
    setAnalyzingIds((prev) => { const next = new Set(prev); next.delete(attempt.id); return next })
  }

  async function analyzeClass(quizId: string) {
    const quiz = quizzes.find((q) => q.id === quizId)
    if (!quiz) return
    setAnalyzingClass(true)
    await new Promise((r) => setTimeout(r, 1500))
    const quizAttempts = allAttempts.filter((a) => a.quizId === quizId)
    const summary = generateClassSummary(quizAttempts, quiz.title)
    setClassSummary((prev) => ({ ...prev, [quizId]: summary }))
    setAnalyzingClass(false)
  }

  if (isLoading || !user) return null

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:p-8 p-4 pt-16 lg:pt-8 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Analisis Nilai AI</h1>
          <p className="text-muted-foreground">Gunakan AI untuk menganalisis performa kelas dan individu siswa.</p>
        </div>

        {/* Quiz filter */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative">
            <select
              value={selectedQuiz}
              onChange={(e) => setSelectedQuiz(e.target.value)}
              className="pl-4 pr-9 py-2.5 rounded-xl border border-input bg-white text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition appearance-none font-medium"
            >
              <option value="all">Semua Kuis</option>
              {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {filteredAttempts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border p-12 text-center">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart2 className="w-7 h-7 text-primary" />
            </div>
            <p className="font-semibold text-foreground mb-1">Belum ada data</p>
            <p className="text-sm text-muted-foreground">Belum ada siswa yang mengumpulkan kuis.</p>
          </div>
        ) : (
          <>
            {/* Stats overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Rata-rata Kelas", value: avg, icon: <BarChart2 className="w-4 h-4" />, color: "text-primary bg-primary/10", sub: "nilai" },
                { label: "Nilai Tertinggi", value: highest, icon: <TrendingUp className="w-4 h-4" />, color: "text-green-600 bg-green-50", sub: "nilai" },
                { label: "Nilai Terendah", value: lowest, icon: <TrendingDown className="w-4 h-4" />, color: "text-red-600 bg-red-50", sub: "nilai" },
                { label: "Tingkat Kelulusan", value: `${scores.length ? Math.round((passing / scores.length) * 100) : 0}%`, icon: <Users className="w-4 h-4" />, color: "text-amber-600 bg-amber-50", sub: `${passing}/${scores.length} siswa` },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl border border-border p-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>{s.icon}</div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.sub}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6 mb-6">
              {/* Score distribution chart */}
              <div className="bg-white rounded-2xl border border-border p-5">
                <h2 className="font-bold text-foreground mb-4">Distribusi Nilai</h2>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={distribution} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(v) => [`${v} siswa`, "Jumlah"]} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {distribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Class AI analysis */}
              <div className="bg-white rounded-2xl border border-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <h2 className="font-bold text-foreground">Analisis AI Kelas</h2>
                  </div>
                  {selectedQuiz !== "all" && (
                    <button
                      onClick={() => analyzeClass(selectedQuiz)}
                      disabled={analyzingClass}
                      className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${analyzingClass ? "animate-spin" : ""}`} />
                      {analyzingClass ? "Menganalisis..." : "Analisis"}
                    </button>
                  )}
                </div>
                {selectedQuiz !== "all" && classSummary[selectedQuiz] ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">{classSummary[selectedQuiz]}</p>
                ) : selectedQuiz !== "all" && analyzingClass ? (
                  <div className="flex items-center gap-3 py-4">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-muted-foreground">AI sedang menganalisis data kelas...</span>
                  </div>
                ) : selectedQuiz === "all" ? (
                  <p className="text-sm text-muted-foreground">Pilih kuis tertentu untuk mendapatkan analisis AI per kuis.</p>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <Sparkles className="w-8 h-8 text-primary/30" />
                    <p className="text-sm text-muted-foreground">Klik tombol &quot;Analisis&quot; untuk mendapatkan ringkasan AI tentang performa kelas.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Per-student analysis */}
            <div className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-bold text-foreground">Analisis Per Siswa</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Klik &quot;Analisis AI&quot; untuk mendapatkan umpan balik personal untuk setiap siswa.</p>
              </div>
              <div className="divide-y divide-border">
                {filteredAttempts.map((attempt) => {
                  const pct = Math.round((attempt.totalScore / attempt.maxScore) * 100)
                  const color = pct >= 80 ? "text-green-600 bg-green-50" : pct >= 60 ? "text-yellow-600 bg-yellow-50" : "text-red-600 bg-red-50"
                  const isAnalyzing = analyzingIds.has(attempt.id)
                  const trend = pct >= 80 ? <TrendingUp className="w-3.5 h-3.5 text-green-600" /> : pct >= 60 ? <Minus className="w-3.5 h-3.5 text-yellow-600" /> : <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                  return (
                    <div key={attempt.id} className="px-5 py-4">
                      <div className="flex items-center gap-4 mb-3">
                        <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {attempt.studentName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground">{attempt.studentName}</p>
                          <p className="text-xs text-muted-foreground">{attempt.studentClass} • {attempt.quizTitle}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {trend}
                          <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${color}`}>{pct}</span>
                        </div>
                        <button
                          onClick={() => analyzeStudent(attempt)}
                          disabled={isAnalyzing}
                          className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                        >
                          <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-pulse" : ""}`} />
                          {isAnalyzing ? "Menganalisis..." : "Analisis AI"}
                        </button>
                      </div>
                      {isAnalyzing && (
                        <div className="flex items-center gap-2 bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 text-sm text-primary">
                          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                          AI sedang menganalisis jawaban {attempt.studentName.split(" ")[0]}...
                        </div>
                      )}
                      {!isAnalyzing && attempt.aiAnalysis && (
                        <div className="bg-primary/5 border border-primary/10 rounded-xl px-4 py-3">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-semibold text-primary">Analisis AI</span>
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">{attempt.aiAnalysis}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
