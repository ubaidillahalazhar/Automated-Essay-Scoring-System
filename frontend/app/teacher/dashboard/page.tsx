"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/shared/sidebar"
import { getStoredQuizzes, getStoredAttempts, type Quiz, type QuizAttempt } from "@/lib/store"
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

// ─── Subject config ──────────────────────────────────────────────────────────
const SUBJECTS = [
  "Matematika",
  "Bahasa Inggris",
  "IPA",
  "IPS",
  "Bahasa Indonesia",
  "Pendidikan Kewarganegaraan",
  "Pendidikan Jasmani Olahraga dan Kesehatan",
  "Seni Budaya dan Prakarya",
  "IPAS",
  "Pendidikan Pancasila",
]

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
}

const CLASSES = ["Kelas I", "Kelas II", "Kelas III", "Kelas IV", "Kelas V", "Kelas VI"]

const SYMBOL_POSITIONS: React.CSSProperties[] = [
  { top: "10px", left: "14px" },
  { top: "16px", right: "16px" },
  { bottom: "28px", left: "28px" },
  { bottom: "12px", right: "14px" },
]

// ─── Quiz thumbnail ──────────────────────────────────────────────────────────
function QuizThumbnail({
  subject,
  type,
  level,
  soal,
}: {
  subject: string
  type?: string
  level?: string
  soal: number
}) {
  const cfg = SUBJECT_COLORS[subject] ?? { from: "#607D8B", to: "#37474F", label: "?" }
  const syms = THUMB_SYMBOLS[subject] ?? ["+", "−", "×", "÷"]

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
        <span className={styles.thumbBadgeType}>{type ?? "Latihan"}</span>
        <span className={styles.thumbBadgeInfo}>
          {level ?? "Reguler"} · {soal} Soal
        </span>
      </div>
    </div>
  )
}

// ─── Quiz card ───────────────────────────────────────────────────────────────
function QuizCard({ quiz, attempts }: { quiz: Quiz; attempts: QuizAttempt[] }) {
  const pct =
    attempts.length
      ? Math.round(
          attempts.reduce((s, a) => s + (a.totalScore / a.maxScore) * 100, 0) / attempts.length
        )
      : null

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
      <QuizThumbnail subject={quiz.subject} soal={quiz.questions.length} />

      <div className={styles.cardBody}>
        <div className={styles.cardRec}>
          <CheckCircle2 width={10} height={10} />
          <span>Rekomendasi</span>
        </div>

        <div className={styles.cardMeta}>
          <div className={styles.cardMetaLeft}>
            <span className={styles.cardMetaItem}>
              <Heart width={10} height={10} /> {attempts.length}
            </span>
            <span className={styles.cardMetaItem}>
              <MessageCircle width={10} height={10} /> 0
            </span>
          </div>
          {pct !== null && <span className={scoreClass}>{pct}%</span>}
        </div>

        <p className={styles.cardTitle}>{quiz.title}</p>

        <Link href={`/teacher/quizzes/${quiz.id}`} className={styles.btnPilih}>
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

  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [activeSubject, setActiveSubject] = useState("Matematika")
  const [activeClass, setActiveClass] = useState("Kelas VI")

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "teacher")) router.replace("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    const allQuizzes = getStoredQuizzes()
    const allAttempts = getStoredAttempts()
    setQuizzes(allQuizzes.filter((q) => q.teacherId === user?.id))
    setAttempts(allAttempts)
  }, [user])

  if (isLoading || !user) return null

  const myQuizIds = new Set(quizzes.map((q) => q.id))
  const myAttempts = attempts.filter((a) => myQuizIds.has(a.quizId))

  const filtered = quizzes.filter(
    (q) => q.subject === activeSubject && (!q.class || q.class === activeClass)
  )

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
              value={activeClass}
              onChange={(e) => setActiveClass(e.target.value)}
              className={styles.classSelect}
            >
              {CLASSES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Subject pills */}
          <div className={styles.pillsRow}>
            {SUBJECTS.map((s) => (
              <button
                key={s}
                onClick={() => setActiveSubject(s)}
                className={s === activeSubject ? styles.pillActive : styles.pill}
              >
                {s}
              </button>
            ))}
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

          {/* Cards grid */}
          <div className={styles.grid}>
            {filtered.length === 0 ? (
              <EmptyState subject={activeSubject} />
            ) : (
              filtered.map((quiz) => (
                <QuizCard
                  key={quiz.id}
                  quiz={quiz}
                  attempts={myAttempts.filter((a) => a.quizId === quiz.id)}
                />
              ))
            )}
          </div>

          {/* AI Analysis */}
          {myAttempts.length > 0 && (
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