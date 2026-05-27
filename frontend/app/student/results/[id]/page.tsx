"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import {
  CheckCircle2, XCircle, ChevronLeft, RotateCcw, Sparkles,
  AlertCircle, Loader2, Trophy, Award, Target
} from "lucide-react"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

// ─────────────────────────────────────────────────────────────────────
// Tipe data dari backend GET /api/exams/attempt/:attempt_token
// ─────────────────────────────────────────────────────────────────────
interface ApiAnswer {
  question_id: number
  question_text: string
  weight: number
  answer_key: string | null
  answer_id: number | null
  answer_text: string
  ai_score: number
  final_score: number
  feedback: string | null
  is_correct: boolean
}

interface ApiAttemptData {
  attempt_token: string
  quiz: {
    quiz_id: number
    title: string
    description: string | null
    subject: string
    teacher_name: string
  }
  student: { user_id: number; name: string }
  completed_at: string
  answers: ApiAnswer[]
  total_score: number
  max_score: number
}

export default function ResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<ApiAttemptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [activeTab, setActiveTab] = useState<"overview" | "answers">("overview")

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function fetchAttempt() {
      setLoading(true)
      setError("")

      try {
        const res = await fetch(`${BACKEND_URL}/api/exams/attempt/${id}`)
        const json = await res.json()
        if (cancelled) return

        if (!res.ok) {
          setError(json.message || "Gagal memuat hasil.")
          setData(null)
        } else {
          setData(json.data)
        }
      } catch (err) {
        if (!cancelled) {
          setError("Tidak dapat menghubungi server.")
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAttempt()
    return () => { cancelled = true }
  }, [id])

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="bg-white rounded-2xl border border-border p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Hasil Tidak Ditemukan</h2>
          <p className="text-muted-foreground text-sm mb-5">{error || "Data attempt tidak ditemukan."}</p>
          <Link
            href={user?.role === "teacher" ? "/teacher/scores" : "/student/results"}
            className="inline-block px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition"
          >
            Kembali
          </Link>
        </div>
      </div>
    )
  }

  if (!user) return null

  const isTeacherViewing = user.role === "teacher"

  const pct = data.max_score > 0 ? Math.round((data.total_score / data.max_score) * 100) : 0
  const isGreat = pct >= 80
  const isOk = pct >= 60
  const scoreColor = isGreat ? "text-green-600" : isOk ? "text-yellow-600" : "text-red-600"
  const scoreBg = isGreat
    ? "from-green-50 to-green-100/50"
    : isOk
    ? "from-yellow-50 to-yellow-100/50"
    : "from-red-50 to-red-100/50"

  const correctCount = data.answers.filter((a) => a.is_correct).length

  const motivationalText = pct >= 90 ? "Luar Biasa! Sempurna! 🎉"
    : pct >= 80 ? "Bagus Sekali! Pertahankan! 👏"
    : pct >= 70 ? "Cukup Baik! Terus Belajar! 📚"
    : pct >= 60 ? "Lumayan. Masih Perlu Ditingkatkan."
    : "Belum Berhasil. Jangan Menyerah! 💪"

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-border px-4 lg:px-8 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Link
          href={isTeacherViewing ? "/teacher/scores" : "/student/results"}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Kembali
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground truncate">{data.quiz.title}</p>
          <p className="text-xs text-muted-foreground">
            {isTeacherViewing
              ? `Hasil ${data.student.name}`
              : data.quiz.subject && `${data.quiz.subject}`}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Score card */}
        <div className={`rounded-2xl border border-border bg-gradient-to-br ${scoreBg} p-6 text-center`}>
          <p className="text-sm font-medium text-muted-foreground mb-2">
            {isTeacherViewing ? "Nilai Siswa" : "Nilai Kamu"}
          </p>
          <p className={`text-7xl font-black mb-1 ${scoreColor}`}>{pct}</p>
          <p className="text-muted-foreground text-sm mb-4">
            dari 100 · {data.total_score.toFixed(1)} poin
          </p>
          <p className={`text-base font-semibold ${scoreColor}`}>{motivationalText}</p>

          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="bg-white/70 rounded-xl p-3">
              <Trophy className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-lg font-bold text-foreground">{correctCount}/{data.answers.length}</p>
              <p className="text-xs text-muted-foreground">Benar</p>
            </div>
            <div className="bg-white/70 rounded-xl p-3">
              <Target className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-lg font-bold text-foreground">{data.max_score}</p>
              <p className="text-xs text-muted-foreground">Skor Maks</p>
            </div>
            <div className="bg-white/70 rounded-xl p-3">
              <Award className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-lg font-bold text-foreground">
                {new Date(data.completed_at).toLocaleDateString("id-ID", {
                  day: "numeric", month: "short"
                })}
              </p>
              <p className="text-xs text-muted-foreground">Tanggal</p>
            </div>
          </div>
        </div>

        {/* Info quiz */}
        <div className="bg-white rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <p className="text-muted-foreground">
              Dinilai oleh AI · Guru: <strong>{data.quiz.teacher_name || "-"}</strong>
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(["overview", "answers"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "bg-white border border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              {tab === "overview" ? "Ringkasan" : "Detail Jawaban"}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-3">
            {data.answers.map((ans, i) => {
              const finalScore = ans.final_score || 0
              const pctSoal = Math.round(finalScore)
              return (
                <div
                  key={ans.question_id}
                  className="bg-white rounded-2xl border border-border p-4 flex items-center gap-4"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    ans.is_correct ? "bg-green-50" : "bg-red-50"
                  }`}>
                    {ans.is_correct
                      ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                      : <XCircle className="w-4 h-4 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground mb-0.5">Soal {i + 1}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{ans.question_text}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-foreground">{pctSoal}/100</p>
                    <p className="text-xs text-muted-foreground">bobot {ans.weight}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Tab: Detail Jawaban */}
        {activeTab === "answers" && (
          <div className="space-y-4">
            {data.answers.map((ans, i) => (
              <div key={ans.question_id} className="bg-white rounded-2xl border border-border overflow-hidden">
                <div className="px-5 py-4 border-b border-border bg-muted/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-primary mb-1">Soal {i + 1}</p>
                      <p className="text-sm font-semibold text-foreground">{ans.question_text}</p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                      ans.is_correct ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                    }`}>
                      {Math.round(ans.final_score)}/100
                    </span>
                  </div>
                </div>

                <div className="px-5 py-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      {isTeacherViewing ? "Jawaban Siswa" : "Jawabanmu"}
                    </p>
                    <p className="text-sm text-foreground bg-muted/50 rounded-lg px-3 py-2.5 leading-relaxed whitespace-pre-wrap">
                      {ans.answer_text || <span className="text-muted-foreground italic">Tidak dijawab</span>}
                    </p>
                  </div>

                  {/* Kunci jawaban HANYA tampil untuk guru */}
                  {ans.answer_key && isTeacherViewing && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                        Jawaban Referensi
                      </p>
                      <p className="text-sm text-foreground bg-green-50 rounded-lg px-3 py-2.5 leading-relaxed border border-green-100 whitespace-pre-wrap">
                        {ans.answer_key}
                      </p>
                    </div>
                  )}

                  {/* Feedback AI */}
                  {ans.feedback && (
                    <div className={`flex gap-2 px-3 py-2.5 rounded-lg text-sm ${
                      ans.is_correct ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"
                    }`}>
                      <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold mb-0.5">Catatan AI:</p>
                        <p>{ans.feedback}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons (untuk siswa saja) */}
        {!isTeacherViewing && (
          <div className="pt-2">
            <Link
              href="/student/assignments"
              className="block w-full py-3 rounded-xl border border-border text-sm font-semibold text-center text-foreground hover:bg-muted transition-colors"
            >
              Kembali ke Tugas
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
