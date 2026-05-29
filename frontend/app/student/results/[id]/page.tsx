"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import {
  CheckCircle2, XCircle, ChevronLeft, Sparkles, AlertCircle, Loader2,
  Trophy, Award, Target, Clock, Pencil, Save, X, Check, ShieldCheck, Hourglass
} from "lucide-react"
import { apiFetch } from "@/lib/api"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface ApiAnswer {
  question_id: number
  question_text: string
  weight: number
  answer_key: string | null
  score_id: number | null
  answer_id: number | null
  answer_text: string
  ai_score: number | null
  final_score: number | null
  feedback: string | null
  is_approved: boolean
  is_correct: boolean | null
}

interface ApiAttemptData {
  attempt_token: string
  quiz: { quiz_id: number; title: string; description: string | null; subject: string; teacher_name: string }
  student: { user_id: number; name: string }
  completed_at: string
  answers: ApiAnswer[]
  total_score: number | null
  max_score: number
  is_fully_approved: boolean
  approved_count: number
  total_questions: number
}

export default function ResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<ApiAttemptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [activeTab, setActiveTab] = useState<"overview" | "answers">("answers")
  const [approvingAll, setApprovingAll] = useState(false)

  const isTeacher = user?.role === "teacher"

  async function loadAttempt() {
    setLoading(true)
    setError("")
    try {
      const viewer = isTeacher ? "teacher" : "student"
      const res = await apiFetch(`${BACKEND_URL}/api/exams/attempt/${id}?viewer=${viewer}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.message || "Gagal memuat hasil.")
        setData(null)
      } else {
        setData(json.data)
      }
    } catch (err) {
      setError("Tidak dapat menghubungi server.")
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    if (!id || isLoading || !user) return
    loadAttempt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isLoading, user])

  async function handleApproveAll() {
    if (!data) return
    setApprovingAll(true)
    try {
      const res = await apiFetch(`${BACKEND_URL}/api/exams/attempt/${data.attempt_token}/approve-all`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" }
      })
      const json = await res.json()
      if (res.ok) {
        await loadAttempt()
      } else {
        alert(json.message || "Gagal menyetujui semua nilai.")
      }
    } catch (err) {
      alert("Terjadi kesalahan koneksi.")
    } finally {
      setApprovingAll(false)
    }
  }

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
          <p className="text-muted-foreground text-sm mb-5">{error || "Data tidak ditemukan."}</p>
          <Link
            href={isTeacher ? "/teacher/scores" : "/student/results"}
            className="inline-block px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition"
          >
            Kembali
          </Link>
        </div>
      </div>
    )
  }

  if (!user) return null

  // ── SISWA + belum diapprove → tampilkan "Menunggu koreksi" ──
  if (!isTeacher && !data.is_fully_approved) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-white border-b border-border px-4 lg:px-8 py-4 flex items-center gap-4 sticky top-0 z-10">
          <Link href="/student/results" className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" /> Kembali
          </Link>
          <p className="font-bold text-foreground truncate">{data.quiz.title}</p>
        </div>

        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Hourglass className="w-10 h-10 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">Menunggu Koreksi Guru</h2>
          <p className="text-muted-foreground mb-2">
            Jawabanmu untuk <strong>{data.quiz.title}</strong> sudah berhasil dikumpulkan.
          </p>
          <p className="text-muted-foreground text-sm mb-8">
            Nilai akan muncul di sini setelah guru selesai mengoreksi dan menyetujui hasilmu.
            Silakan cek kembali nanti.
          </p>
          <div className="bg-muted/40 rounded-xl p-4 mb-6">
            <p className="text-xs text-muted-foreground mb-1">Status</p>
            <p className="font-semibold text-amber-700 flex items-center justify-center gap-1.5">
              <Hourglass className="w-4 h-4" /> Belum dikoreksi
            </p>
          </div>
          <Link
            href="/student/results"
            className="inline-block px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition"
          >
            Kembali ke Nilai Saya
          </Link>
        </div>
      </div>
    )
  }

  const totalScore = data.total_score ?? 0
  const pct = data.max_score > 0 ? Math.round((totalScore / data.max_score) * 100) : 0
  const isGreat = pct >= 80
  const isOk = pct >= 60
  const scoreColor = isGreat ? "text-green-600" : isOk ? "text-yellow-600" : "text-red-600"
  const scoreBg = isGreat ? "from-green-50 to-green-100/50" : isOk ? "from-yellow-50 to-yellow-100/50" : "from-red-50 to-red-100/50"
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
          href={isTeacher ? "/teacher/scores" : "/student/results"}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Kembali
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground truncate">{data.quiz.title}</p>
          <p className="text-xs text-muted-foreground">
            {isTeacher ? `Hasil ${data.student.name}` : data.quiz.subject}
          </p>
        </div>
        {/* Badge status approval */}
        {data.is_fully_approved ? (
          <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700">
            <ShieldCheck className="w-3.5 h-3.5" /> Disetujui
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
            <Hourglass className="w-3.5 h-3.5" /> {data.approved_count}/{data.total_questions} dikoreksi
          </span>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Banner approve all untuk guru */}
        {isTeacher && !data.is_fully_approved && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex gap-3">
              <Hourglass className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Perlu Dikoreksi</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Siswa belum bisa melihat nilai sampai semua jawaban disetujui.
                  Edit nilai bila perlu, lalu setujui.
                </p>
              </div>
            </div>
            <button
              onClick={handleApproveAll}
              disabled={approvingAll}
              className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
            >
              {approvingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Setujui Semua
            </button>
          </div>
        )}

        {/* Score card */}
        <div className={`rounded-2xl border border-border bg-gradient-to-br ${scoreBg} p-6 text-center`}>
          <p className="text-sm font-medium text-muted-foreground mb-2">
            {isTeacher ? "Nilai Siswa" : "Nilai Kamu"}
          </p>
          <p className={`text-7xl font-black mb-1 ${scoreColor}`}>{pct}</p>
          <p className="text-muted-foreground text-sm mb-4">dari 100 · {totalScore.toFixed(1)} poin</p>
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
              <Clock className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-lg font-bold text-foreground">
                {new Date(data.completed_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
              </p>
              <p className="text-xs text-muted-foreground">Tanggal</p>
            </div>
          </div>
        </div>

        {/* Daftar jawaban dengan edit & approve (untuk guru) */}
        <div className="space-y-4">
          {data.answers.map((ans, i) => (
            <AnswerCard
              key={ans.question_id}
              answer={ans}
              index={i}
              isTeacher={isTeacher}
              onUpdated={loadAttempt}
            />
          ))}
        </div>

        {!isTeacher && (
          <Link
            href="/student/results"
            className="block w-full py-3 rounded-xl border border-border text-sm font-semibold text-center text-foreground hover:bg-muted transition-colors"
          >
            Kembali ke Nilai Saya
          </Link>
        )}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// Komponen card jawaban — dengan edit & approve untuk guru
// ═════════════════════════════════════════════════════════════════
function AnswerCard({
  answer,
  index,
  isTeacher,
  onUpdated
}: {
  answer: ApiAnswer
  index: number
  isTeacher: boolean
  onUpdated: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [scoreVal, setScoreVal] = useState(String(answer.final_score ?? 0))
  const [feedbackVal, setFeedbackVal] = useState(answer.feedback || "")
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)

  async function handleSave() {
    if (!answer.score_id) return
    setSaving(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/exams/score/${answer.score_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          final_score: parseFloat(scoreVal),
          feedback: feedbackVal
        })
      })
      const json = await res.json()
      if (res.ok) {
        setEditing(false)
        onUpdated()
      } else {
        alert(json.message || "Gagal menyimpan.")
      }
    } catch (err) {
      alert("Terjadi kesalahan koneksi.")
    } finally {
      setSaving(false)
    }
  }

  async function handleApprove() {
    if (!answer.score_id) return
    setApproving(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/exams/score/${answer.score_id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" }
      })
      if (res.ok) onUpdated()
      else {
        const json = await res.json()
        alert(json.message || "Gagal menyetujui.")
      }
    } catch (err) {
      alert("Terjadi kesalahan koneksi.")
    } finally {
      setApproving(false)
    }
  }

  const finalScore = answer.final_score ?? 0

  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      {/* Header soal */}
      <div className="px-5 py-4 border-b border-border bg-muted/30">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-semibold text-primary">Soal {index + 1}</p>
              {/* Badge approval per soal */}
              {answer.is_approved ? (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                  <Check className="w-2.5 h-2.5" /> Disetujui
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                  <Hourglass className="w-2.5 h-2.5" /> Belum
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-foreground">{answer.question_text}</p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
            answer.is_correct ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}>
            {Math.round(finalScore)}/100
          </span>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* Jawaban siswa */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            {isTeacher ? "Jawaban Siswa" : "Jawabanmu"}
          </p>
          <p className="text-sm text-foreground bg-muted/50 rounded-lg px-3 py-2.5 leading-relaxed whitespace-pre-wrap">
            {answer.answer_text || <span className="text-muted-foreground italic">Tidak dijawab</span>}
          </p>
        </div>

        {/* Kunci jawaban (guru saja) */}
        {answer.answer_key && isTeacher && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Jawaban Referensi
            </p>
            <p className="text-sm text-foreground bg-green-50 rounded-lg px-3 py-2.5 leading-relaxed border border-green-100 whitespace-pre-wrap">
              {answer.answer_key}
            </p>
          </div>
        )}

        {/* Mode edit untuk guru */}
        {isTeacher && editing ? (
          <div className="space-y-3 bg-blue-50/50 rounded-xl p-3 border border-blue-100">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Nilai (0-100)</label>
              <input
                type="number" min="0" max="100"
                value={scoreVal}
                onChange={(e) => setScoreVal(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Feedback</label>
              <textarea
                value={feedbackVal}
                onChange={(e) => setFeedbackVal(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Simpan
              </button>
              <button
                onClick={() => { setEditing(false); setScoreVal(String(finalScore)); setFeedbackVal(answer.feedback || "") }}
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted"
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          /* Feedback display */
          answer.feedback && (
            <div className={`flex gap-2 px-3 py-2.5 rounded-lg text-sm ${
              answer.is_correct ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"
            }`}>
              <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold mb-0.5">Catatan{isTeacher ? " AI" : ""}:</p>
                <p>{answer.feedback}</p>
              </div>
            </div>
          )
        )}

        {/* Tombol aksi guru: Edit + Approve */}
        {isTeacher && !editing && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setEditing(true)}
              className="flex-1 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted flex items-center justify-center gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit Nilai
            </button>
            {!answer.is_approved && (
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex-1 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Setujui
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
