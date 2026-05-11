"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/shared/sidebar"
import { getStoredQuizzes, getStoredAttempts, type Quiz } from "@/lib/store"
import { Clock, BookOpen, CheckCircle2, AlertCircle, Circle } from "lucide-react"

export default function StudentAssignments() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all")

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "student")) router.replace("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    const allQuizzes = getStoredQuizzes()
    const attempts = getStoredAttempts()
    const myAttempts = attempts.filter((a) => a.studentId === user?.id)
    setCompletedIds(new Set(myAttempts.map((a) => a.quizId)))
    setQuizzes(allQuizzes.filter((q) => q.isActive && q.class === user?.class))
  }, [user])

  if (isLoading || !user) return null

  const filtered = quizzes.filter((q) => {
    if (filter === "pending") return !completedIds.has(q.id)
    if (filter === "completed") return completedIds.has(q.id)
    return true
  })

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:p-8 p-4 pt-16 lg:pt-8 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Tugas Saya</h1>
          <p className="text-muted-foreground">Daftar semua kuis yang diberikan untuk kelasmu.</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {(["all", "pending", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f ? "bg-primary text-primary-foreground" : "bg-white border border-border text-muted-foreground hover:border-primary/30"}`}
            >
              {f === "all" ? "Semua" : f === "pending" ? "Tertunda" : "Selesai"}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl border border-border p-12 text-center">
              <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground mb-1">Tidak ada tugas</p>
              <p className="text-sm text-muted-foreground">Belum ada kuis dalam kategori ini.</p>
            </div>
          ) : (
            filtered.map((quiz) => {
              const done = completedIds.has(quiz.id)
              const dueDate = new Date(quiz.dueDate)
              const isOverdue = !done && dueDate < new Date()
              return (
                <div key={quiz.id} className="bg-white rounded-2xl border border-border p-5 flex flex-col gap-4 hover:shadow-sm hover:border-primary/20 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    {done ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                      </span>
                    ) : isOverdue ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                        <AlertCircle className="w-3.5 h-3.5" /> Terlambat
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
                        <Circle className="w-3.5 h-3.5" /> Tertunda
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-foreground mb-1">{quiz.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{quiz.description}</p>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {quiz.timeLimit} menit</span>
                    <span>{quiz.questions.length} soal</span>
                    <span>{quiz.subject}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-medium ${isOverdue ? "text-red-600" : "text-muted-foreground"}`}>
                      Tenggat: {dueDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>

                  {done ? (
                    <Link
                      href={`/student/results`}
                      className="w-full py-2.5 rounded-xl bg-green-50 text-green-700 text-sm font-semibold text-center hover:bg-green-100 transition-colors"
                    >
                      Lihat Nilai
                    </Link>
                  ) : (
                    <Link
                      href={`/student/quiz/${quiz.id}`}
                      className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold text-center hover:bg-primary/90 transition-colors"
                    >
                      Mulai Kuis
                    </Link>
                  )}
                </div>
              )
            })
          )}
        </div>
      </main>
    </div>
  )
}
