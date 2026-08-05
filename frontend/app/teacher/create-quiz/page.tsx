"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/shared/sidebar"
import { type Question } from "@/lib/store"
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Save, CheckCircle2 } from "lucide-react"
import { apiFetch } from "@/lib/api"

interface GradeDB {
  grade_id: number;
  grade_name: string;
}

interface SubjectDB {
  subject_id: number;
  subject_name: string;
}

const EMPTY_QUESTION = (): Question => ({
  id: `q-${Date.now()}-${Math.random()}`,
  text: "",
  type: "essay",
  correctAnswer: "",
  points: 20,
})

export default function CreateQuizPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [subjectInput, setSubjectInput] = useState("")
  const [description, setDescription] = useState("")
  const [timeLimit, setTimeLimit] = useState(30)
  
  const [targetGradeId, setTargetGradeId] = useState<number>(1)
  const [availableGrades, setAvailableGrades] = useState<GradeDB[]>([])
  
  const [dueDate, setDueDate] = useState("")
  const [questions, setQuestions] = useState<Question[]>([EMPTY_QUESTION()])
  const [expandedQ, setExpandedQ] = useState<string | null>(questions[0]?.id)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  // STATE BARU: Menyimpan daftar mata pelajaran dari database
  const [existingSubjects, setExistingSubjects] = useState<SubjectDB[]>([])

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "teacher")) router.replace("/login")
  }, [user, isLoading, router])

  // Fetch data Kelas dan Mata Pelajaran dari database
  useEffect(() => {
    if (!user) return;
    const teacherId = user.id;

    async function fetchMasterData() {
      try {
        const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        
        // 1. Fetch Daftar Kelas
        const resGrades = await apiFetch(`/api/grades`);
        const dataGrades = await resGrades.json();
        if (resGrades.ok && dataGrades.data) {
          setAvailableGrades(dataGrades.data);
          if (dataGrades.data.length > 0) setTargetGradeId(dataGrades.data[0].grade_id);
        }

        // 2. Fetch Daftar Mata Pelajaran Guru
        const resSubjects = await apiFetch(`/api/subjects/teacher/${teacherId}`);
        const dataSubjects = await resSubjects.json();
        if (resSubjects.ok && dataSubjects.data) {
          setExistingSubjects(dataSubjects.data);
        }
      } catch (error) {
        console.error("Gagal memuat data master:", error);
      }
    }

    fetchMasterData();
  }, [user]);

  function addQuestion() {
    const q = EMPTY_QUESTION()
    setQuestions((prev) => [...prev, q])
    setExpandedQ(q.id)
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  function updateQuestion(id: string, field: keyof Question, value: string | number) {
    setQuestions((prev) => prev.map((q) => q.id === id ? { ...q, [field]: value } : q))
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

  async function handleSave() {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return
    
    setSaving(true)
    
    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const teacherId = user ? user.id : 1;

      // 1. Logika Cerdas Mata Pelajaran (Cek atau Buat Baru)
      let finalSubjectId = null;
      const matchedSubject = existingSubjects.find(
        s => s.subject_name.toLowerCase() === subjectInput.trim().toLowerCase()
      );

      if (matchedSubject) {
        finalSubjectId = matchedSubject.subject_id;
      } else {
        const resNewSubj = await apiFetch(`/api/subjects`, {
  method: 'POST',
  body: JSON.stringify({ subject_name: subjectInput.trim() })
});
        const dataNewSubj = await resNewSubj.json();
        if (!resNewSubj.ok) throw new Error(dataNewSubj.message || "Gagal membuat mata pelajaran.");
        finalSubjectId = dataNewSubj.data.subject_id;
      }

      const payload = {
        title,
        description,
        subject_id: finalSubjectId,
        timeLimit: Number(timeLimit),
        grade_id: targetGradeId,
        dueDate,
        created_by: teacherId,
        questions: questions.map((q) => ({
          text: q.text,
          points: Number(q.points),
          correctAnswer: q.correctAnswer
        }))
      }

      const response = await apiFetch(`/api/exams`, {
  method: 'POST',
  body: JSON.stringify(payload),
});

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Gagal menyimpan kuis ke database.");
      }

      setSaved(true)
      setTimeout(() => router.push("/teacher/quizzes"), 1500)

    } catch (err: any) {
      console.error("❌ Error saat menyimpan kuis:", err);
      setErrors({ global: err.message || "Terjadi kesalahan koneksi ke server." });
      alert(err.message || "Gagal terhubung ke server backend.");
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !user) return null

  const totalPoints = questions.reduce((s, q) => s + q.points, 0)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:p-8 p-4 pt-16 lg:pt-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-1">Buat Kuis Baru</h1>
            <p className="text-muted-foreground">Isi detail kuis dan tambahkan soal-soal essay.</p>
          </div>

          {saved && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-5 flex items-center gap-2 text-green-700 font-medium text-sm">
              <CheckCircle2 className="w-4 h-4" /> Kuis berhasil disimpan! Mengarahkan...
            </div>
          )}

          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
              <h2 className="font-bold text-foreground">Informasi Kuis</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1.5">Judul Kuis *</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: Aljabar Linear Dasar"
                    className={`w-full px-4 py-2.5 rounded-xl border ${errors.title ? "border-destructive" : "border-input"} bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm`}
                  />
                  {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
                </div>
                
                {/* PERUBAHAN 1: Input Mata Pelajaran dengan Datalist (Searchable) */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Mata Pelajaran *</label>
                  <input
                    list="subject-suggestions"
                    value={subjectInput}
                    onChange={(e) => setSubjectInput(e.target.value)}
                    placeholder="Pilih atau ketik mata pelajaran..."
                    className={`w-full px-4 py-2.5 rounded-xl border ${errors.subject ? "border-destructive" : "border-input"} bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm`}
                  />
                  <datalist id="subject-suggestions">
                    {existingSubjects.map((subj) => (
                      <option key={subj.subject_id} value={subj.subject_name} />
                    ))}
                  </datalist>
                  {errors.subject && <p className="text-xs text-destructive mt-1">{errors.subject}</p>}
                </div>

                {/* PERUBAHAN 2: Dropdown Kelas disamakan dengan Dashboard */}
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
                    placeholder="Deskripsi singkat tentang kuis ini..."
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-foreground">Soal ({questions.length})</h2>
                  <p className="text-xs text-muted-foreground">Total: {totalPoints} poin</p>
                </div>
                <button
                  onClick={addQuestion}
                  className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Tambah Soal
                </button>
              </div>

              <div className="space-y-3">
                {questions.map((q, i) => (
                  <div key={q.id} className="border border-border rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-foreground">Soal {i + 1}</span>
                        {q.text && <span className="text-xs text-muted-foreground ml-2 truncate hidden sm:inline">— {q.text.slice(0, 50)}...</span>}
                      </div>
                      <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full flex-shrink-0">{q.points} poin</span>
                      {expandedQ === q.id ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                    </button>

                    {expandedQ === q.id && (
                      <div className="px-4 py-4 space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Pertanyaan *</label>
                          <textarea
                            value={q.text}
                            onChange={(e) => updateQuestion(q.id, "text", e.target.value)}
                            placeholder="Tulis pertanyaan essay di sini..."
                            rows={3}
                            className={`w-full px-3 py-2.5 rounded-lg border ${errors[`q-${i}-text`] ? "border-destructive" : "border-input"} bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm resize-none`}
                          />
                          {errors[`q-${i}-text`] && <p className="text-xs text-destructive mt-1">{errors[`q-${i}-text`]}</p>}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Jawaban Referensi / Kunci Jawaban *</label>
                          <textarea
                            value={q.correctAnswer}
                            onChange={(e) => updateQuestion(q.id, "correctAnswer", e.target.value)}
                            placeholder="Tulis jawaban yang diharapkan sebagai acuan penilaian..."
                            rows={3}
                            className={`w-full px-3 py-2.5 rounded-lg border ${errors[`q-${i}-answer`] ? "border-destructive" : "border-input"} bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm resize-none`}
                          />
                          {errors[`q-${i}-answer`] && <p className="text-xs text-destructive mt-1">{errors[`q-${i}-answer`]}</p>}
                        </div>
                        <div className="flex items-center justify-between">
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
                          {questions.length > 1 && (
                            <button
                              onClick={() => removeQuestion(q.id)}
                              className="flex items-center gap-1.5 text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Hapus Soal
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={addQuestion}
                className="mt-3 w-full py-2.5 rounded-xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Tambah Soal Baru
              </button>
            </div>

            <div className="flex gap-3 pb-8">
              <button
                onClick={() => router.back()}
                className="px-5 py-3 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</>
                ) : saved ? (
                  <><CheckCircle2 className="w-4 h-4" /> Tersimpan!</>
                ) : (
                  <><Save className="w-4 h-4" /> Simpan Kuis</>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}