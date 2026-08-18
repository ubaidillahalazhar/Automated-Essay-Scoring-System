"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/shared/sidebar"
import {
  ArrowLeft, Loader2, Search, CheckCircle2, Circle, Users
} from "lucide-react"
import styles from "@/styles/teacher-dashboard.module.css"
import { apiFetch } from "@/lib/api"

interface SubjectBreakdown {
  subject_name: string
  completed_questions: number
  pending_questions: number
  avg_score: number | null
}

interface StudentOverview {
  student_id: number
  student_name: string
  class_name: string
  subjects: SubjectBreakdown[]
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#ca8a04' : '#dc2626'
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color }}>{score}%</span>
  )
}

function StudentCard({ student }: { student: StudentOverview }) {
  const completedSubjects = student.subjects.filter((s) => s.completed_questions > 0)
  const pendingSubjects = student.subjects.filter((s) => s.pending_questions > 0)
  const totalCompleted = student.subjects.reduce((sum, s) => sum + s.completed_questions, 0)
  const totalQuestions = student.subjects.reduce((sum, s) => sum + s.completed_questions + s.pending_questions, 0)

  return (
    <Link
      href={`/teacher/scores?student=${encodeURIComponent(student.student_name)}`}
      className="block bg-white rounded-2xl border border-border p-4 hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-foreground">{student.student_name}</p>
          <p className="text-xs text-muted-foreground">{student.class_name}</p>
        </div>
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {totalCompleted}/{totalQuestions} soal
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-green-700 flex items-center gap-1 mb-2">
            <CheckCircle2 width={12} height={12} /> Sudah Dikerjakan
          </p>
          {completedSubjects.length === 0 ? (
            <p className="text-xs text-muted-foreground">Belum ada.</p>
          ) : (
            <ul className="space-y-1.5">
              {completedSubjects.map((s) => (
                <li key={s.subject_name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-foreground truncate">{s.subject_name} {s.completed_questions}</span>
                  {s.avg_score !== null && <ScoreBadge score={s.avg_score} />}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-amber-700 flex items-center gap-1 mb-2">
            <Circle width={12} height={12} /> Belum Dikerjakan
          </p>
          {pendingSubjects.length === 0 ? (
            <p className="text-xs text-muted-foreground">Tidak ada.</p>
          ) : (
            <ul className="space-y-1.5">
              {pendingSubjects.map((s) => (
                <li key={s.subject_name} className="text-xs text-foreground truncate">
                  {s.subject_name} {s.pending_questions}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function TeacherStudentsOverview() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  const [students, setStudents] = useState<StudentOverview[]>([])
  const [fetching, setFetching] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "teacher")) router.replace("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function loadData() {
      setFetching(true)
      try {
        const res = await apiFetch(`/api/exams/teacher/${user!.id}/students`)
        const json = await res.json()
        if (cancelled) return
        if (res.ok) setStudents(json.data || [])
      } catch (err) {
        console.error("Gagal memuat data siswa:", err)
      } finally {
        if (!cancelled) setFetching(false)
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [user])

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students
    const q = search.toLowerCase()
    return students.filter((s) =>
      s.student_name.toLowerCase().includes(q) || s.class_name.toLowerCase().includes(q)
    )
  }, [students, search])

  if (isLoading || !user) {
    return (
      <div className={styles.wrapper}>
        <Sidebar />
        <div className={styles.body} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 className="animate-spin" width={32} height={32} />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <Sidebar />

      <div className={styles.body}>
        <main className={styles.main}>

          <div className={styles.pageHeader}>
            <div className={styles.pageTitleRow}>
              <Link
                href="/teacher/dashboard"
                style={{ display: 'flex', alignItems: 'center', color: '#6b7280' }}
              >
                <ArrowLeft width={18} height={18} />
              </Link>
              <h1 className={styles.pageTitle}>Siswa Unik</h1>
            </div>
          </div>

          <div style={{ marginTop: 8, marginBottom: 16, maxWidth: 320 }}>
            <div style={{ position: 'relative' }}>
              <Search
                width={14}
                height={14}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama siswa atau kelas..."
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  backgroundColor: 'white',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {fetching ? (
            <div style={{
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              padding: 80, color: '#9ca3af'
            }}>
              <Loader2 className="animate-spin" width={28} height={28} />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className={styles.empty}>
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <p className={styles.emptyTitle}>
                {students.length === 0 ? "Belum ada siswa di kelas kuis Anda." : "Tidak ada siswa yang cocok."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredStudents.map((s) => (
                <StudentCard key={s.student_id} student={s} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
