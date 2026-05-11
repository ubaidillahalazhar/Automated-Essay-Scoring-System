"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/shared/sidebar"
import { getStoredQuizzes, getStoredAttempts, saveQuizzes, type Quiz } from "@/lib/store"
import { PlusSquare, FileText, Clock, Users, Trash2, ToggleLeft, ToggleRight } from "lucide-react"

export default function TeacherQuizzes() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "teacher")) router.replace("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    if (!user) return
    const all = getStoredQuizzes()
    const mine = all.filter((q) => q.teacherId === user.id)
    setQuizzes(mine)
    const attempts = getStoredAttempts()
    const counts: Record<string, number> = {}
    attempts.forEach((a) => { counts[a.quizId] = (counts[a.quizId] || 0) + 1 })
    setAttemptCounts(counts)
  }, [user])

  function toggleActive(quizId: string) {
    const all = getStoredQuizzes()
    const updated = all.map((q) => q.id === quizId ? { ...q, isActive: !q.isActive } : q)
    saveQuizzes(updated)
    setQuizzes(updated.filter((q) => q.teacherId === user?.id))
  }

  function deleteQuiz(quizId: string) {
    if (!confirm("Hapus kuis ini? Tindakan ini tidak dapat dibatalkan.")) return
    const all = getStoredQuizzes()
    const updated = all.filter((q) => q.id !== quizId)
    saveQuizzes(updated)
    setQuizzes(updated.filter((q) => q.teacherId === user?.id))
  }

  if (isLoading || !user) return null

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:p-8 p-4 pt-16 lg:pt-8 overflow-y-auto">
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Kuis Saya</h1>
            <p className="text-muted-foreground">Kelola semua kuis yang telah kamu buat.</p>
          </div>
          <Link href="/teacher/create-quiz" className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors flex-shrink-0">
            <PlusSquare className="w-4 h-4" /> Buat Kuis
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quizzes.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl border border-border p-12 text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-7 h-7 text-primary" />
              </div>
              <p className="font-semibold text-foreground mb-1">Belum ada kuis</p>
              <p className="text-sm text-muted-foreground mb-4">Mulai buat kuis pertamamu.</p>
              <Link href="/teacher/create-quiz" className="inline-block px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors">
                Buat Kuis Sekarang
              </Link>
            </div>
          ) : (
            quizzes.map((quiz) => (
              <div key={quiz.id} className="bg-white rounded-2xl border border-border p-5 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground leading-tight">{quiz.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{quiz.subject} • {quiz.class}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${quiz.isActive ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {quiz.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </div>

                {quiz.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{quiz.description}</p>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {quiz.timeLimit} menit</span>
                  <span>{quiz.questions.length} soal</span>
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {attemptCounts[quiz.id] || 0} pengumpulan</span>
                </div>

                <div className="text-xs text-muted-foreground">
                  Tenggat: {new Date(quiz.dueDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                </div>

                <div className="flex gap-2 pt-1 border-t border-border">
                  <button
                    onClick={() => toggleActive(quiz.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {quiz.isActive
                      ? <ToggleRight className="w-4 h-4 text-green-600" />
                      : <ToggleLeft className="w-4 h-4" />}
                    {quiz.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={() => deleteQuiz(quiz.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
