"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/shared/sidebar"
import {
  PlusSquare,
  ChevronRight,
  ChevronLeft,
  BarChart2,
  CheckCircle2,
  Heart,
  MessageCircle,
  Search,
  Sun,
  Bell,
  LayoutGrid,
  Star,
} from "lucide-react"
import styles from "@/styles/teacher-dashboard.module.css"

// ─── Types (sesuai struktur API backend) ─────────────────────────────────────
interface SubjectDB {
  subject_id: number
  subject_name: string
}

interface GradeDB {
  grade_id: number
  grade_name: string
  school_level?: string
}

interface QuizDB {
  quiz_id: number
  title: string
  description: string | null
  time_limit: number
  due_date: string
  created_at: string
  subject_id: number
  grade_id: number
  subject: SubjectDB
  grade: GradeDB
  _count: { questions: number }
}

// ─── Subject visual config ───────────────────────────────────────────────────
// Tetap pakai konfigurasi warna/simbol berdasarkan nama mapel.
// Kalau nama mapel guru tidak ada di mapping, fallback ke warna abu-abu.
const SUBJECT_COLORS: Record<string, { from: string; to: string; label: string }> = {
  "Matematika":                                  { from: "#FF8C00", to: "#E65100", label: "MAT" },
  "Bahasa Inggris":                              { from: "#0288D1", to: "#01579B", label: "ENG" },
  "IPA":                                         { from: "#43A047", to: "#1B5E20", label: "IPA" },
  "IPS":                                         { from: "#E53935", to: "#B71C1C", label: "IPS" },
  "Bahasa Indonesia":                            { from: "#8E24AA", to: "#4A148C", label: "BIN" },
  "Pendidikan Kewarganegaraan":                  { from: "#F57C00", to: "#BF360C", label: "PKN" },
  "Pendidikan Jasmani Olahraga dan Kesehatan":   { from: "#00897B", to: "#004D40", label: "PJOK" },
  "Seni Budaya dan Prakarya":                    { from: "#D81B60", to: "#880E4F", label: "SBdP" },
  "IPAS":                                        { from: "#039BE5", to: "#01579B", label: "IPAS" },
  "Pendidikan Pancasila":                        { from: "#C62828", to: "#7F0000", label: "PP" },
  "Olahraga":                                    { from: "#00897B", to: "#004D40", label: "OR" },
}

const THUMB_SYMBOLS: Record<string, string[]> = {
  "Matematika":                                  ["+", "−", "×", "÷"],
  "Bahasa Inggris":                              ["A", "B", "C", "abc"],
  "IPA":                                         ["⚗", "🔬", "⚡", "🌿"],
  "IPS":                                         ["🗺", "🏛", "⊕", "✦"],
  "Bahasa Indonesia":                            ["A", "a", "✎", "≡"],
  "Pendidikan Kewarganegaraan":                  ["★", "⚖", "✦", "●"],
  "Pendidikan Jasmani Olahraga dan Kesehatan":   ["⚽", "🏃", "◎", "▲"],
  "Seni Budaya dan Prakarya":                    ["♪", "✦", "◆", "●"],
  "IPAS":                                        ["☀", "🌍", "★", "○"],
  "Pendidikan Pancasila":                        ["★", "⚖", "✦", "●"],
  "Olahraga":                                    ["⚽", "🏃", "◎", "▲"],
}

const SYMBOL_POSITIONS: React.CSSProperties[] = [
  { top: "10px", left: "14px" },
  { top: "16px", right: "16px" },
  { bottom: "28px", left: "28px" },
  { bottom: "12px", right: "14px" },
]

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

// Util: ambil 3 huruf pertama mapel kalau tidak ada di mapping
function fallbackLabel(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 4)
    .toUpperCase()
}

// ─── Quiz thumbnail ──────────────────────────────────────────────────────────
function QuizThumbnail({
  subjectName,
  soal,
  level,
}: {
  subjectName: string
  soal: number
  level?: string
}) {
  const cfg =
    SUBJECT_COLORS[subjectName] ?? {
      from: "#607D8B",
      to: "#37474F",
      label: fallbackLabel(subjectName),
    }
  const syms = THUMB_SYMBOLS[subjectName] ?? ["✦", "●", "◆", "○"]

  return (
    <div
      className={styles.thumb}
      style={{ background: `linear-gradient(135deg, ${cfg.from} 0%, ${cfg.to} 100%)` }}
    >
      {syms.slice(0, 4).map((sym, i) => (
        <span key={i} className={styles.thumbSymbol} style={SYMBOL_POSITIONS[i]}>
          {sym}
        </span>
      ))}

      <div className={styles.thumbLabel}>{cfg.label}</div>

      <div className={styles.thumbBadge}>
        <span className={styles.thumbBadgeType}>Latihan</span>
        <span className={styles.thumbBadgeInfo}>
          {level ?? "Reguler"} · {soal} Soal
        </span>
      </div>
    </div>
  )
}

// ─── Quiz card ───────────────────────────────────────────────────────────────
function QuizCard({ quiz }: { quiz: QuizDB }) {
  // Catatan: untuk sekarang attempts belum di-fetch dari backend
  // karena endpoint khusus belum tersedia. Bagian rata-rata skor sengaja
  // dibuat null. Akan mudah ditambahkan nanti via endpoint analytics.
  const pct: number | null = null
  const attemptsCount = 0

  const scoreClass =
    pct === null
      ? ""
      : pct >= 80
      ? styles.scoreGreen
      : pct >= 60
      ? styles.scoreYellow
      : styles.scoreRed

  return (
    <div className={styles.card}>
      <QuizThumbnail
        subjectName={quiz.subject.subject_name}
        soal={quiz._count.questions}
        level={quiz.grade?.grade_name}
      />

      <div className={styles.cardBody}>
        <div className={styles.cardRec}>
          <CheckCircle2 width={10} height={10} />
          <span>Rekomendasi</span>
        </div>

        <div className={styles.cardMeta}>
          <div className={styles.cardMetaLeft}>
            <span className={styles.cardMetaItem}>
              <Heart width={10} height={10} /> {attemptsCount}
            </span>
            <span className={styles.cardMetaItem}>
              <MessageCircle width={10} height={10} /> 0
            </span>
          </div>
          {pct !== null && <span className={scoreClass}>{pct}%</span>}
        </div>

        <p className={styles.cardTitle}>{quiz.title}</p>

        <Link href={`/teacher/quizzes/${quiz.quiz_id}`} className={styles.btnPilih}>
          Pilih Kuis
        </Link>
      </div>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ subject }: { subject: string }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <PlusSquare width={28} height={28} color="#FF8C00" />
      </div>
      <p className={styles.emptyTitle}>Belum ada kuis untuk {subject}</p>
      <p className={styles.emptyDesc}>Buat kuis pertama untuk mata pelajaran ini.</p>
      <Link href="/teacher/create-quiz" className={styles.btnEmptyCta}>
        Buat Kuis Sekarang
      </Link>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function TeacherDashboard() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  const [quizzes, setQuizzes] = useState<QuizDB[]>([])
  const [subjects, setSubjects] = useState<SubjectDB[]>([])
  const [grades, setGrades] = useState<GradeDB[]>([])

  const [activeSubjectId, setActiveSubjectId] = useState<number | null>(null)
  const [activeGradeId, setActiveGradeId] = useState<number | null>(null)

  const [fetching, setFetching] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // ── Guard route ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && (!user || user.role !== "teacher")) router.replace("/login")
  }, [user, isLoading, router])

  // ── Fetch semua data master + kuis ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return

    let cancelled = false

    async function loadAll() {
      setFetching(true)
      setFetchError(null)
      try {
        const teacherId = user!.id
        const level = user!.school_level || "SD"

        const [resQuizzes, resSubjects, resGrades] = await Promise.all([
          fetch(`${BACKEND_URL}/api/exams/teacher/${teacherId}`),
          fetch(`${BACKEND_URL}/api/subjects/teacher/${teacherId}`),
          fetch(`${BACKEND_URL}/api/grades?level=${encodeURIComponent(level)}`),
        ])

        const [dQuizzes, dSubjects, dGrades] = await Promise.all([
          resQuizzes.json(),
          resSubjects.json(),
          resGrades.json(),
        ])

        if (cancelled) return

        if (!resQuizzes.ok) throw new Error(dQuizzes.message || "Gagal memuat kuis")
        if (!resSubjects.ok) throw new Error(dSubjects.message || "Gagal memuat mapel")
        if (!resGrades.ok) throw new Error(dGrades.message || "Gagal memuat kelas")

        const quizzesData: QuizDB[] = dQuizzes.data ?? []
        const subjectsData: SubjectDB[] = dSubjects.data ?? []
        const gradesData: GradeDB[] = dGrades.data ?? []

        setQuizzes(quizzesData)
        setSubjects(subjectsData)
        setGrades(gradesData)

        // Default pilih mapel pertama (kalau ada) dan kelas pertama
        if (subjectsData.length > 0 && activeSubjectId === null) {
          setActiveSubjectId(subjectsData[0].subject_id)
        }
        if (gradesData.length > 0 && activeGradeId === null) {
          setActiveGradeId(gradesData[0].grade_id)
        }
      } catch (err: any) {
        if (!cancelled) setFetchError(err.message || "Terjadi kesalahan koneksi.")
      } finally {
        if (!cancelled) setFetching(false)
      }
    }

    loadAll()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  if (isLoading || !user) return null

  // ── Filter kuis sesuai mapel + kelas yang aktif ────────────────────────────
  const filtered = quizzes.filter((q) => {
    const matchSubject = activeSubjectId === null || q.subject_id === activeSubjectId
    const matchGrade = activeGradeId === null || q.grade_id === activeGradeId
    return matchSubject && matchGrade
  })

  const activeSubjectName =
    subjects.find((s) => s.subject_id === activeSubjectId)?.subject_name ?? "—"

  return (
    <div className={styles.wrapper}>
      <Sidebar />

      <div className={styles.body}>
        {/* ── Topbar ── */}
        <div className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={styles.iconBtn}>
              <LayoutGrid width={14} height={14} />
            </button>
            <button className={styles.iconBtn}>
              <Star width={14} height={14} />
            </button>
          </div>

          <div className={styles.topbarRight}>
            <div className={styles.searchBox}>
              <Search width={12} height={12} />
              <span>Search</span>
              <kbd>⌘/</kbd>
            </div>
            <button className={styles.iconBtnBorderless}>
              <Sun width={14} height={14} />
            </button>
            <button className={styles.iconBtnBorderless}>
              <Bell width={14} height={14} />
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        <main className={styles.main}>
          {/* Page header */}
          <div className={styles.pageHeader}>
            <div className={styles.pageTitleRow}>
              <h1 className={styles.pageTitle}>Buat Kuis</h1>
              <button className={styles.helpBtn}>?</button>
            </div>
            <Link href="/teacher/create-quiz" className={styles.btnCreate}>
              <PlusSquare width={14} height={14} />
              Buat Soal
            </Link>
          </div>

          {/* Tab */}
          <div className={styles.tabRow}>
            <button className={styles.tabActive}>Buat Kuis</button>
          </div>

          {/* Filter row */}
          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>Pilih Mata Pelajaran</span>
            <select
              value={activeGradeId ?? ""}
              onChange={(e) => setActiveGradeId(Number(e.target.value))}
              className={styles.classSelect}
              disabled={grades.length === 0}
            >
              {grades.length === 0 ? (
                <option value="">— Tidak ada kelas —</option>
              ) : (
                grades.map((g) => (
                  <option key={g.grade_id} value={g.grade_id}>
                    {g.grade_name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Subject pills (dari DB) */}
          <div className={styles.pillsRow}>
            {subjects.length === 0 && !fetching ? (
              <span className={styles.filterLabel}>
                Belum ada mata pelajaran. Buat kuis pertamamu untuk membuat mapel otomatis.
              </span>
            ) : (
              subjects.map((s) => (
                <button
                  key={s.subject_id}
                  onClick={() => setActiveSubjectId(s.subject_id)}
                  className={
                    s.subject_id === activeSubjectId ? styles.pillActive : styles.pill
                  }
                >
                  {s.subject_name}
                </button>
              ))
            )}
          </div>

          {/* Nav arrows */}
          <div className={styles.navRow}>
            <button className={styles.navBtn}>
              <ChevronLeft width={12} height={12} />
            </button>
            <button className={styles.navBtn}>
              <ChevronRight width={12} height={12} />
            </button>
          </div>

          {/* Cards grid / state */}
          {fetching ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Memuat data dari database...</p>
            </div>
          ) : fetchError ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Gagal memuat data</p>
              <p className={styles.emptyDesc}>{fetchError}</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {filtered.length === 0 ? (
                <EmptyState subject={activeSubjectName} />
              ) : (
                filtered.map((quiz) => <QuizCard key={quiz.quiz_id} quiz={quiz} />)
              )}
            </div>
          )}

          {/* AI Analysis link — tampilkan kalau ada kuis */}
          {quizzes.length > 0 && (
            <Link href="/teacher/analysis" className={styles.analysisLink}>
              <BarChart2 width={16} height={16} />
              Lihat Analisis AI
              <ChevronRight width={16} height={16} />
            </Link>
          )}
        </main>
      </div>
    </div>
  )
}
