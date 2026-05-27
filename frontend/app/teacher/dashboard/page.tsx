"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/shared/sidebar"
import { useToast } from "@/hooks/use-toast"
import {
  ChevronRight, BarChart2, CheckCircle2, Heart,
  MessageCircle, Search, Pencil, Trash2, Loader2, AlertTriangle, X, PlusSquare
} from "lucide-react"
import styles from "@/styles/teacher-dashboard.module.css"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
const LS_GRADE_FILTER_KEY = "teacher_dashboard_grade_filter"

interface QuizDB {
  quiz_id: number
  title: string
  description: string | null
  time_limit: number
  due_date: string
  subject: { subject_id: number; subject_name: string }
  grade: { grade_id: number; grade_name: string; school_level?: string }
  _count: { questions: number }
}

interface SubjectDB {
  subject_id: number
  subject_name: string
}

interface GradeDB {
  grade_id: number
  grade_name: string
  school_level: string
}

const SUBJECT_COLORS: Record<string, { from: string; to: string; label: string; syms: string[] }> = {
  "Matematika":       { from: "#FF8C00", to: "#E65100", label: "MAT",  syms: ["+", "−", "×", "÷"] },
  "Bahasa Inggris":   { from: "#0288D1", to: "#01579B", label: "ENG",  syms: ["A", "B", "C", "abc"] },
  "IPA":              { from: "#43A047", to: "#1B5E20", label: "IPA",  syms: ["⚗", "🔬", "⚡", "🌿"] },
  "IPS":              { from: "#E53935", to: "#B71C1C", label: "IPS",  syms: ["🗺", "🏛", "⊕", "✦"] },
  "Bahasa Indonesia": { from: "#8E24AA", to: "#4A148C", label: "BIN",  syms: ["A", "a", "✎", "≡"] },
  "Olahraga":         { from: "#00897B", to: "#004D40", label: "OR",   syms: ["⚽", "🏃", "◎", "▲"] },
  "PJOK":             { from: "#00897B", to: "#004D40", label: "PJOK", syms: ["⚽", "🏃", "◎", "▲"] },
  "Seni Budaya":      { from: "#D81B60", to: "#880E4F", label: "SBdP", syms: ["♪", "✦", "◆", "●"] },
  "PKN":              { from: "#F57C00", to: "#BF360C", label: "PKN",  syms: ["★", "⚖", "✦", "●"] },
}

const DEFAULT_COLORS = { from: "#607D8B", to: "#37474F", label: "?", syms: ["•", "•", "•", "•"] }

const SYMBOL_POSITIONS: React.CSSProperties[] = [
  { top: "10px", left: "14px" },
  { top: "16px", right: "16px" },
  { bottom: "28px", left: "28px" },
  { bottom: "12px", right: "14px" },
]

function getSubjectConfig(subjectName: string) {
  if (SUBJECT_COLORS[subjectName]) return SUBJECT_COLORS[subjectName]
  for (const key in SUBJECT_COLORS) {
    if (subjectName.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(subjectName.toLowerCase())) {
      return SUBJECT_COLORS[key]
    }
  }
  const label = subjectName.split(" ").map(w => w[0]).join("").substring(0, 4).toUpperCase()
  return { ...DEFAULT_COLORS, label: label || "?" }
}

function QuizThumbnail({ subject, soal, gradeName }: { subject: string; soal: number; gradeName: string }) {
  const cfg = getSubjectConfig(subject)
  return (
    <div
      className={styles.thumb}
      style={{ background: `linear-gradient(135deg, ${cfg.from} 0%, ${cfg.to} 100%)` }}
    >
      {cfg.syms.slice(0, 4).map((sym, i) => (
        <span key={i} className={styles.thumbSymbol} style={SYMBOL_POSITIONS[i]}>
          {sym}
        </span>
      ))}
      <div className={styles.thumbLabel}>{cfg.label}</div>
      <div className={styles.thumbBadge}>
        <span className={styles.thumbBadgeType}>Latihan</span>
        <span className={styles.thumbBadgeInfo}>
          {gradeName} · {soal} Soal
        </span>
      </div>
    </div>
  )
}

function QuizCard({
  quiz,
  onDelete
}: {
  quiz: QuizDB
  onDelete: (quizId: number, quizTitle: string) => void
}) {
  return (
    <div className={styles.card}>
      <QuizThumbnail
        subject={quiz.subject?.subject_name || ""}
        soal={quiz._count?.questions || 0}
        gradeName={quiz.grade?.grade_name || "-"}
      />

      <div className={styles.cardBody}>
        <div className={styles.cardRec}>
          <CheckCircle2 width={10} height={10} />
          <span>Rekomendasi</span>
        </div>

        <div className={styles.cardMeta}>
          <div className={styles.cardMetaLeft}>
            <span className={styles.cardMetaItem}>
              <Heart width={10} height={10} /> 0
            </span>
            <span className={styles.cardMetaItem}>
              <MessageCircle width={10} height={10} /> 0
            </span>
          </div>
        </div>

        <p className={styles.cardTitle}>{quiz.title}</p>

        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <Link
            href={`/teacher/edit-quiz/${quiz.quiz_id}`}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '6px 10px',
              borderRadius: 8,
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              fontSize: 11,
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dbeafe'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
          >
            <Pencil width={11} height={11} /> Edit
          </Link>
          <button
            onClick={() => onDelete(quiz.quiz_id, quiz.title)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '6px 10px',
              borderRadius: 8,
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              fontSize: 11,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
          >
            <Trash2 width={11} height={11} /> Hapus
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{message}</p>
      <Link href="/teacher/create-quiz" className={styles.btnEmptyCta}>
        Buat Kuis Baru
      </Link>
    </div>
  )
}

function DeleteConfirmModal({
  quizTitle,
  onConfirm,
  onCancel,
  loading
}: {
  quizTitle: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, zIndex: 50
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: 16, padding: 24,
        maxWidth: 400, width: '100%', border: '1px solid #e5e7eb'
      }}>
        <div style={{
          width: 48, height: 48, backgroundColor: '#fee2e2', borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16
        }}>
          <AlertTriangle width={24} height={24} color="#dc2626" />
        </div>
        <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Hapus kuis?</h3>
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20, lineHeight: 1.5 }}>
          Yakin ingin menghapus <strong>{quizTitle}</strong>? Tindakan ini tidak bisa dibatalkan
          dan semua jawaban siswa pada kuis ini akan ikut terhapus.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 12,
              border: '1px solid #e5e7eb', backgroundColor: 'white',
              fontSize: 14, fontWeight: 500, cursor: 'pointer'
            }}
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 12,
              backgroundColor: '#dc2626', color: 'white',
              fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
            }}
          >
            {loading && <Loader2 width={14} height={14} className="animate-spin" />}
            {loading ? "Menghapus..." : "Ya, Hapus"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TeacherDashboard() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [quizzes, setQuizzes] = useState<QuizDB[]>([])
  const [subjects, setSubjects] = useState<SubjectDB[]>([])
  const [grades, setGrades] = useState<GradeDB[]>([])
  const [fetching, setFetching] = useState(true)

  const [activeSubjectId, setActiveSubjectId] = useState<"all" | number>("all")
  const [activeGradeId, setActiveGradeId] = useState<"all" | number>("all")
  const [searchSubject, setSearchSubject] = useState("")

  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "teacher")) router.replace("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = localStorage.getItem(LS_GRADE_FILTER_KEY)
    if (saved) {
      if (saved === "all") setActiveGradeId("all")
      else {
        const parsed = parseInt(saved)
        if (!isNaN(parsed)) setActiveGradeId(parsed)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    localStorage.setItem(LS_GRADE_FILTER_KEY, String(activeGradeId))
  }, [activeGradeId])

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const userId = user.id

    async function loadData() {
      setFetching(true)
      try {
        const [quizzesRes, subjectsRes, gradesRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/exams/teacher/${userId}`),
          fetch(`${BACKEND_URL}/api/subjects/teacher/${userId}`),
          fetch(`${BACKEND_URL}/api/grades`),
        ])

        const quizzesJson = await quizzesRes.json()
        const subjectsJson = await subjectsRes.json()
        const gradesJson = await gradesRes.json()

        if (cancelled) return

        if (quizzesRes.ok) setQuizzes(quizzesJson.data || [])
        if (subjectsRes.ok) setSubjects(subjectsJson.data || [])
        if (gradesRes.ok) setGrades(gradesJson.data || [])
      } catch (err) {
        console.error("Gagal memuat data dashboard:", err)
      } finally {
        if (!cancelled) setFetching(false)
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [user])

  const filteredSubjects = useMemo(() => {
    if (!searchSubject.trim()) return subjects
    const q = searchSubject.toLowerCase()
    return subjects.filter(s => s.subject_name.toLowerCase().includes(q))
  }, [subjects, searchSubject])

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((q) => {
      const matchSubject = activeSubjectId === "all" || q.subject?.subject_id === activeSubjectId
      const matchGrade = activeGradeId === "all" || q.grade?.grade_id === activeGradeId
      return matchSubject && matchGrade
    })
  }, [quizzes, activeSubjectId, activeGradeId])

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${BACKEND_URL}/api/exams/${deleteTarget.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      })
      const result = await res.json()

      if (!res.ok) {
        toast({
          title: "Gagal menghapus kuis",
          description: result.message || "Terjadi kesalahan saat menghapus.",
          variant: "destructive"
        })
        return
      }

      setQuizzes(prev => prev.filter(q => q.quiz_id !== deleteTarget.id))
      toast({
        title: "Kuis berhasil dihapus",
        description: `"${deleteTarget.title}" telah dihapus dari sistem.`
      })
      setDeleteTarget(null)
    } catch (err) {
      console.error("Error hapus kuis:", err)
      toast({
        title: "Gagal menghapus kuis",
        description: "Terjadi kesalahan koneksi ke server.",
        variant: "destructive"
      })
    } finally {
      setDeleting(false)
    }
  }

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

  const activeSubjectName = activeSubjectId === "all"
    ? "Semua Mapel"
    : subjects.find(s => s.subject_id === activeSubjectId)?.subject_name || "Mapel"

  return (
    <div className={styles.wrapper}>
      <Sidebar />

      <div className={styles.body}>
        <main className={styles.main}>

          {/* Page header: kiri = title "Dashboard", kanan = tombol Buat Kuis */}
          <div className={styles.pageHeader}>
            <div className={styles.pageTitleRow}>
              <h1 className={styles.pageTitle}>Dashboard</h1>
              <button className={styles.helpBtn}>?</button>
            </div>

            {/* Tombol Buat Kuis di pojok kanan atas */}
            <Link
              href="/teacher/create-quiz"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 10,
                backgroundColor: '#f5a623',
                color: 'white',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'background-color 0.2s',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e8970a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f5a623'}
            >
              <PlusSquare width={14} height={14} />
              Buat Kuis
            </Link>
          </div>

          {/* Search input di kiri (gantikan posisi lama tombol Buat Kuis) */}
          <div style={{ marginTop: 8, marginBottom: 16, maxWidth: 320 }}>
            <div style={{ position: 'relative' }}>
              <Search
                width={14}
                height={14}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }}
              />
              <input
                type="text"
                value={searchSubject}
                onChange={(e) => setSearchSubject(e.target.value)}
                placeholder="Cari mata pelajaran..."
                style={{
                  width: '100%',
                  padding: '8px 32px 8px 36px',
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  backgroundColor: 'white',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
              {searchSubject && (
                <button
                  onClick={() => setSearchSubject("")}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 4,
                    color: '#9ca3af'
                  }}
                >
                  <X width={14} height={14} />
                </button>
              )}
            </div>
          </div>

          {/* Filter row: label + dropdown kelas */}
          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>Pilih Mata Pelajaran</span>
            <select
              value={activeGradeId === "all" ? "all" : String(activeGradeId)}
              onChange={(e) => {
                const val = e.target.value
                setActiveGradeId(val === "all" ? "all" : parseInt(val))
              }}
              className={styles.classSelect}
            >
              <option value="all">Semua Kelas</option>
              {grades.map((g) => (
                <option key={g.grade_id} value={g.grade_id}>
                  {g.grade_name} ({g.school_level})
                </option>
              ))}
            </select>
          </div>

          {/* Subject pills */}
          <div className={styles.pillsRow}>
            <button
              onClick={() => setActiveSubjectId("all")}
              className={activeSubjectId === "all" ? styles.pillActive : styles.pill}
            >
              Semua
            </button>

            {filteredSubjects.map((s) => (
              <button
                key={s.subject_id}
                onClick={() => setActiveSubjectId(s.subject_id)}
                className={s.subject_id === activeSubjectId ? styles.pillActive : styles.pill}
              >
                {s.subject_name}
              </button>
            ))}

            {searchSubject && filteredSubjects.length === 0 && (
              <span style={{ padding: '6px 12px', color: '#9ca3af', fontSize: 12 }}>
                Tidak ada mapel cocok "{searchSubject}"
              </span>
            )}
          </div>

          {/* Cards grid */}
          {fetching ? (
            <div style={{
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              padding: 80, color: '#9ca3af'
            }}>
              <Loader2 className="animate-spin" width={28} height={28} />
            </div>
          ) : (
            <div className={styles.grid}>
              {filteredQuizzes.length === 0 ? (
                <EmptyState
                  message={
                    activeSubjectId === "all" && activeGradeId === "all"
                      ? "Belum ada kuis. Mulai buat kuis pertamamu!"
                      : `Belum ada kuis untuk ${activeSubjectName}${activeGradeId !== "all" ? ` di ${grades.find(g => g.grade_id === activeGradeId)?.grade_name || ''}` : ''}.`
                  }
                />
              ) : (
                filteredQuizzes.map((quiz) => (
                  <QuizCard
                    key={quiz.quiz_id}
                    quiz={quiz}
                    onDelete={(id, title) => setDeleteTarget({ id, title })}
                  />
                ))
              )}
            </div>
          )}

          {/* AI Analysis link */}
          {quizzes.length > 0 && (
            <Link href="/teacher/analysis" className={styles.analysisLink}>
              <BarChart2 width={16} height={16} />
              Lihat Analisis AI
              <ChevronRight width={16} height={16} />
            </Link>
          )}
        </main>
      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          quizTitle={deleteTarget.title}
          loading={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  )
}
