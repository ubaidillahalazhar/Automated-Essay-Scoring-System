"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/shared/sidebar"
import { type Question } from "@/lib/store"
import { useToast } from "@/hooks/use-toast"
import { Save, CheckCircle2 } from "lucide-react"
import { apiFetch } from "@/lib/api"

interface GradeDB {
  grade_id: number
  grade_name: string
}

interface SubjectDB {
  subject_id: number
  subject_name: string
}

interface QuizDetailDB {
  quiz_id: number
  title: string
  description: string | null
  time_limit: number
  due_date: string
  subject_id: number
  grade_id: number
  questions: Array<{
    question_id: number
    question_text: string
    weight: number
    answerKey: { key_text: string } | null
  }>
}

type EditQuestion = Question & {
  question_id?: number
}

const EMPTY_QUESTION = (): EditQuestion => ({
  id: `q-${Date.now()}-${Math.random()}`,
  text: "",
  type: "essay",
  correctAnswer: "",
  points: 20
})

function toDateInputValue(dateString: string) {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export default function EditQuizPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const quizId = Number(params.quizId)
  const { toast } = useToast()

  const [title, setTitle] = useState("")
  const [subjectInput, setSubjectInput] = useState("")
  const [description, setDescription] = useState("")
  const [timeLimit, setTimeLimit] = useState(30)
  const [targetGradeId, setTargetGradeId] = useState<number>(1)
  const [availableGrades, setAvailableGrades] = useState<GradeDB[]>([])
  const [existingSubjects, setExistingSubjects] = useState<SubjectDB[]>([])
  const [dueDate, setDueDate] = useState("")
  const [questions, setQuestions] = useState<EditQuestion[]>([])

  const [isFetching, setIsFetching] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "teacher")) router.replace("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    if (!user || Number.isNaN(quizId)) return

    const fetchData = async () => {
      try {
        const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
        const [gradeRes, subjectRes, quizRes] = await Promise.all([
  apiFetch(`/api/grades`),
  apiFetch(`/api/subjects/teacher/${user.id}`),
  apiFetch(`/api/exams/${quizId}/edit`)
])

        const gradeData = await gradeRes.json()
        const subjectData = await subjectRes.json()
        const quizData = await quizRes.json()

        if (gradeRes.ok && gradeData.data) {
          setAvailableGrades(gradeData.data)
        }

        if (subjectRes.ok && subjectData.data) {
          setExistingSubjects(subjectData.data)
        }

        if (!quizRes.ok || !quizData.data) {
          throw new Error(quizData.message || "Gagal memuat detail kuis.")
        }

        const quiz: QuizDetailDB = quizData.data

        setTitle(quiz.title)
        setDescription(quiz.description || "")
        setTimeLimit(quiz.time_limit)
        setTargetGradeId(quiz.grade_id)
        setDueDate(toDateInputValue(quiz.due_date))

        const subjectName = subjectData?.data?.find((s: SubjectDB) => s.subject_id === quiz.subject_id)?.subject_name || ""
        setSubjectInput(subjectName)

        const mappedQuestions: EditQuestion[] = quiz.questions.map((q) => ({
          id: `q-${q.question_id}`,
          question_id: q.question_id,
          text: q.question_text,
          type: "essay",
          correctAnswer: q.answerKey?.key_text || "",
          points: Number(q.weight) || 1
        }))

        setQuestions(mappedQuestions.length > 0 ? mappedQuestions : [EMPTY_QUESTION()])
      } catch (error) {
        console.error("Error fetch edit quiz:", error)
        toast({
          title: "Gagal memuat kuis",
          description: "Data kuis untuk edit tidak bisa dimuat.",
          variant: "destructive"
        })
        router.push("/teacher/quizzes")
      } finally {
        setIsFetching(false)
      }
    }

    fetchData()
  }, [user, quizId, router])

  function addQuestion() {
    setQuestions((prev) => [...prev, EMPTY_QUESTION()])
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  function updateQuestion(id: string, field: keyof EditQuestion, value: string | number) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, [field]: value } : q)))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!title.trim()) e.title = "Judul kuis wajib diisi."
    if (!subjectInput.trim()) e.subject = "Mata pelajaran wajib diisi."
    if (!dueDate) e.dueDate = "Tanggal tenggat wajib diisi."

    questions.forEach((q, i) => {
      if (!q.text.trim()) e[`q-${i}-text`] = "Pertanyaan wajib diisi."
      if (!q.correctAnswer.trim()) e[`q-${i}-answer`] = "Jawaban referensi wajib diisi."
    })

    return e
  }

  async function handleUpdateQuiz() {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return

    setSaving(true)

    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

      let finalSubjectId: number | null = null
      const matchedSubject = existingSubjects.find(
        (s) => s.subject_name.toLowerCase() === subjectInput.trim().toLowerCase()
      )

      if (matchedSubject) {
        finalSubjectId = matchedSubject.subject_id
      } else {
        const createSubjectRes = await apiFetch(`/api/subjects`, {
  method: "POST",
  body: JSON.stringify({ subject_name: subjectInput.trim() })
})

        const createdSubject = await createSubjectRes.json()
        if (!createSubjectRes.ok) {
          throw new Error(createdSubject.message || "Gagal membuat mata pelajaran baru.")
        }

        finalSubjectId = createdSubject.data.subject_id
      }

      const payload = {
        title,
        description,
        subject_id: finalSubjectId,
        timeLimit: Number(timeLimit),
        grade_id: targetGradeId,
        dueDate,
        questions: questions.map((q) => ({
          question_id: q.question_id,
          text: q.text,
          points: Number(q.points),
          correctAnswer: q.correctAnswer
        }))
      }

      const response = await apiFetch(`/api/exams/${quizId}`, {
  method: "PUT",
  body: JSON.stringify(payload)
})

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || "Gagal memperbarui kuis.")
      }

      setSaved(true)
      toast({
        title: "Perubahan disimpan",
        description: result.message || "Kuis berhasil diperbarui."
      })
      setTimeout(() => router.push("/teacher/quizzes"), 1200)
    } catch (error: any) {
      console.error("Error update quiz:", error)
      toast({
        title: "Gagal menyimpan perubahan",
        description: error.message || "Terjadi kesalahan saat menyimpan perubahan kuis.",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const totalPoints = useMemo(() => questions.reduce((sum, q) => sum + Number(q.points || 0), 0), [questions])

  if (isLoading || !user) return null

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:p-8 p-4 pt-16 lg:pt-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-1">Edit Kuis</h1>
            <p className="text-muted-foreground">Perbarui detail kuis dan soal-soal yang sudah ada.</p>
          </div>

          {isFetching ? (
            <div className="text-center p-12 text-muted-foreground">Memuat data kuis...</div>
          ) : (
            <div className="space-y-5">
              {saved && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-5 flex items-center gap-2 text-green-700 font-medium text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Perubahan berhasil disimpan! Mengarahkan...
                </div>
              )}

              <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
                <h2 className="font-bold text-foreground">Informasi Kuis</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-1.5">Judul Kuis *</label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border ${errors.title ? "border-destructive" : "border-input"} bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm`}
                    />
                    {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Mata Pelajaran *</label>
                    <input
                      list="subject-suggestions"
                      value={subjectInput}
                      onChange={(e) => setSubjectInput(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border ${errors.subject ? "border-destructive" : "border-input"} bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm`}
                    />
                    <datalist id="subject-suggestions">
                      {existingSubjects.map((subj) => (
                        <option key={subj.subject_id} value={subj.subject_name} />
                      ))}
                    </datalist>
                    {errors.subject && <p className="text-xs text-destructive mt-1">{errors.subject}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Kelas Target</label>
                    <select
                      value={targetGradeId}
                      onChange={(e) => setTargetGradeId(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm"
                    >
                      {availableGrades.map((g) => (
                        <option key={g.grade_id} value={g.grade_id}>
                          {g.grade_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Waktu (menit)</label>
                    <input
                      type="number"
                      min={5}
                      max={180}
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Tanggal Tenggat *</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border ${errors.dueDate ? "border-destructive" : "border-input"} bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm`}
                    />
                    {errors.dueDate && <p className="text-xs text-destructive mt-1">{errors.dueDate}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-1.5">Deskripsi</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-foreground">Soal ({questions.length}) • Total: {totalPoints} poin</h2>
                  <button
                    onClick={addQuestion}
                    className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    + Tambah Soal
                  </button>
                </div>

                <div className="space-y-4">
                  {questions.map((q, i) => (
                    <div key={q.id} className="border border-border rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm text-foreground">Soal {i + 1}</p>
                        {questions.length > 1 && (
                          <button
                            onClick={() => removeQuestion(q.id)}
                            className="text-xs font-medium text-destructive hover:text-destructive/80"
                          >
                            Hapus Soal
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Pertanyaan *</label>
                        <textarea
                          value={q.text}
                          onChange={(e) => updateQuestion(q.id, "text", e.target.value)}
                          rows={3}
                          className={`w-full px-3 py-2.5 rounded-lg border ${errors[`q-${i}-text`] ? "border-destructive" : "border-input"} bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm resize-none`}
                        />
                        {errors[`q-${i}-text`] && <p className="text-xs text-destructive mt-1">{errors[`q-${i}-text`]}</p>}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Kunci Jawaban *</label>
                        <textarea
                          value={q.correctAnswer}
                          onChange={(e) => updateQuestion(q.id, "correctAnswer", e.target.value)}
                          rows={3}
                          className={`w-full px-3 py-2.5 rounded-lg border ${errors[`q-${i}-answer`] ? "border-destructive" : "border-input"} bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm resize-none`}
                        />
                        {errors[`q-${i}-answer`] && <p className="text-xs text-destructive mt-1">{errors[`q-${i}-answer`]}</p>}
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Poin</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={q.points}
                          onChange={(e) => updateQuestion(q.id, "points", Number(e.target.value))}
                          className="w-20 px-3 py-1.5 rounded-lg border border-input bg-background text-foreground text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => router.push("/teacher/quizzes")}
                  className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleUpdateQuiz}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  <Save className="w-4 h-4" /> {saving ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
