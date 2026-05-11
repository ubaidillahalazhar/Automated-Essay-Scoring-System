"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { getStoredAttempts, getStoredQuizzes, type QuizAttempt, type Quiz } from "@/lib/store"
import { CheckCircle2, XCircle, Clock, ChevronLeft, RotateCcw, Sparkles } from "lucide-react"

export default function ResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [activeTab, setActiveTab] = useState<"overview" | "answers">("overview")

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    const all = getStoredAttempts()
    const found = all.find((a) => a.id === id)
    if (found) {
      setAttempt(found)
      const q = getStoredQuizzes().find((q) => q.id === found.quizId)
      setQuiz(q || null)
    }
  }, [id])

  if (isLoading || !user || !attempt) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const pct = Math.round((attempt.totalScore / attempt.maxScore) * 100)
  const isGreat = pct >= 80
  const isOk = pct >= 60
  const scoreColor = isGreat ? "text-green-600" : isOk ? "text-yellow-600" : "text-red-600"
  const scoreBg = isGreat ? "from-green-50 to-green-100/50" : isOk ? "from-yellow-50 to-yellow-100/50" : "from-red-50 to-red-100/50"
  const timeMins = Math.floor(attempt.timeTaken / 60)
  const timeSecs = attempt.timeTaken % 60
  const correctCount = attempt.answers.filter((a) => a.isCorrect).length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-border px-4 lg:px-8 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Link
          href={user.role === "teacher" ? "/teacher/scores" : "/student/results"}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Kembali
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground truncate">{attempt.quizTitle}</p>
        </div>
        {user.role === "student" && quiz && (
          <Link
            href={`/student/quiz/${quiz.id}`}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline flex-shrink-0"
          >
            <RotateCcw className="w-4 h-4" /> Ulangi
          </Link>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Score card */}
        <div className={`rounded-2xl border border-border bg-gradient-to-br ${scoreBg} p-6 text-center`}>
          <p className="text-sm font-medium text-muted-foreground mb-2">Nilai Kamu</p>
          <p className={`text-7xl font-black mb-1 ${scoreColor}`}>{pct}</p>
          <p className="text-muted-foreground text-sm mb-4">dari 100 | {attempt.totalScore}/{attempt.maxScore} poin</p>
          <p className={`text-base font-semibold ${scoreColor}`}>
            {pct >= 90 ? "Luar Biasa! Sempurna!" : pct >= 80 ? "Bagus Sekali! Pertahankan!" : pct >= 70 ? "Cukup Baik! Terus Belajar!" : pct >= 60 ? "Lumayan. Masih Perlu Ditingkatkan." : "Belum Berhasil. Jangan Menyerah!"}
          </p>

          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="bg-white/70 rounded-xl p-3">
              <p className="text-lg font-bold text-foreground">{correctCount}/{attempt.answers.length}</p>
              <p className="text-xs text-muted-foreground">Jawaban Benar</p>
            </div>
            <div className="bg-white/70 rounded-xl p-3">
              <p className="text-lg font-bold text-foreground">{timeMins}m {timeSecs}s</p>
              <p className="text-xs text-muted-foreground">Waktu Pengerjaan</p>
            </div>
            <div className="bg-white/70 rounded-xl p-3">
              <p className="text-lg font-bold text-foreground">{new Date(attempt.completedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</p>
              <p className="text-xs text-muted-foreground">Tanggal</p>
            </div>
          </div>
        </div>

        {/* AI Analysis */}
        {attempt.aiAnalysis && (
          <div className="bg-white rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <h2 className="font-bold text-foreground">Analisis AI</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{attempt.aiAnalysis}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          {(["overview", "answers"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? "bg-primary text-primary-foreground" : "bg-white border border-border text-muted-foreground hover:border-primary/30"}`}
            >
              {tab === "overview" ? "Ringkasan" : "Detail Jawaban"}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-3">
            {attempt.answers.map((ans, i) => {
              const question = quiz?.questions.find((q) => q.id === ans.questionId)
              const scorePct = question ? Math.round(((ans.score || 0) / question.points) * 100) : 0
              return (
                <div key={ans.questionId} className="bg-white rounded-2xl border border-border p-4 flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${ans.isCorrect ? "bg-green-50" : "bg-red-50"}`}>
                    {ans.isCorrect
                      ? <CheckCircle2 className="w-4.5 h-4.5 text-green-600" />
                      : <XCircle className="w-4.5 h-4.5 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground mb-0.5">Soal {i + 1}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{question?.text}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-foreground">{ans.score}/{question?.points}</p>
                    <p className="text-xs text-muted-foreground">{scorePct}%</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === "answers" && (
          <div className="space-y-4">
            {attempt.answers.map((ans, i) => {
              const question = quiz?.questions.find((q) => q.id === ans.questionId)
              return (
                <div key={ans.questionId} className="bg-white rounded-2xl border border-border overflow-hidden">
                  <div className="px-5 py-4 border-b border-border bg-muted/30">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground flex-1">Soal {i + 1}: {question?.text}</p>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${ans.isCorrect ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                        {ans.score}/{question?.points} poin
                      </span>
                    </div>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Jawabanmu</p>
                      <p className="text-sm text-foreground bg-muted/50 rounded-lg px-3 py-2.5 leading-relaxed">
                        {ans.answer || <span className="text-muted-foreground italic">Tidak dijawab</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Jawaban Referensi</p>
                      <p className="text-sm text-foreground bg-green-50 rounded-lg px-3 py-2.5 leading-relaxed border border-green-100">
                        {question?.correctAnswer}
                      </p>
                    </div>
                    {ans.feedback && (
                      <div className={`flex gap-2 px-3 py-2.5 rounded-lg text-sm ${ans.isCorrect ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
                        <span className="flex-shrink-0">{ans.isCorrect ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <Clock className="w-4 h-4 mt-0.5" />}</span>
                        <span>{ans.feedback}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Action buttons */}
        {user.role === "student" && (
          <div className="flex gap-3 pt-2">
            <Link
              href="/student/assignments"
              className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-center text-foreground hover:bg-muted transition-colors"
            >
              Kembali ke Tugas
            </Link>
            {quiz && (
              <Link
                href={`/student/quiz/${quiz.id}`}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold text-center hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Ulangi Kuis
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
