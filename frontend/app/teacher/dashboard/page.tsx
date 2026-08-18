"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/shared/sidebar"
import {
  Loader2, PlusSquare,
  BookOpen, Users as UsersIcon, Hourglass, AlertCircle
} from "lucide-react"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList
} from "recharts"
import styles from "@/styles/teacher-dashboard.module.css"
import { ChatbotWidget } from "@/components/shared/ChatbotWidget"
import { apiFetch } from "@/lib/api"

interface QuizDB {
  quiz_id: number
  grade?: { grade_name: string; school_level: string } | null
}

interface AttemptDB {
  student_id: number
  student_class: string
  total_score: number | null
  is_approved: boolean
}

interface GradeDB {
  grade_id: number
  grade_name: string
  school_level: string
}

interface TeacherStats {
  totalQuizzes: number
  totalAttempts: number
  uniqueStudents: number
  pendingReview: number
}

interface ClassAverage {
  class_name: string
  avg_score: number
}

function StatCard({
  icon, value, label, href
}: {
  icon: React.ReactNode
  value: number
  label: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-2xl border border-border p-4 block transition-colors hover:border-primary/40"
    >
      <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Link>
  )
}

export default function TeacherDashboard() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  const [quizzes, setQuizzes] = useState<QuizDB[]>([])
  const [attempts, setAttempts] = useState<AttemptDB[]>([])
  const [grades, setGrades] = useState<GradeDB[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "teacher")) router.replace("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const userId = user.id

    async function loadData() {
      setFetching(true)
      try {
        const [quizzesRes, attemptsRes, gradesRes] = await Promise.all([
          apiFetch(`/api/exams/teacher/${userId}`),
          apiFetch(`/api/exams/teacher/${userId}/attempts`),
          apiFetch(`/api/grades`),
        ])
        const quizzesJson = await quizzesRes.json()
        const attemptsJson = await attemptsRes.json()
        const gradesJson = await gradesRes.json()

        if (cancelled) return

        if (quizzesRes.ok) setQuizzes(quizzesJson.data || [])
        if (attemptsRes.ok) setAttempts(attemptsJson.data || [])
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

  const stats: TeacherStats = useMemo(() => {
    const uniqueStudents = new Set(attempts.map((a) => a.student_id)).size
    const pendingReview = attempts.filter((a) => !a.is_approved).length

    return {
      totalQuizzes: quizzes.length,
      totalAttempts: attempts.length,
      uniqueStudents,
      pendingReview
    }
  }, [quizzes, attempts])

  // Jenjang tempat guru mengajar, ditentukan dari kelas target kuis-kuis yang paling sering ia buat.
  const teacherSchoolLevel = useMemo(() => {
    const counts = new Map<string, number>()
    for (const q of quizzes) {
      const level = q.grade?.school_level
      if (!level) continue
      counts.set(level, (counts.get(level) || 0) + 1)
    }
    let best: string | undefined
    let bestCount = 0
    for (const [level, count] of counts) {
      if (count > bestCount) { best = level; bestCount = count }
    }
    return best
  }, [quizzes])

  const classAverages: ClassAverage[] = useMemo(() => {
    const scored = attempts.filter((a) => typeof a.total_score === "number" && a.student_class)
    const byClass = new Map<string, { sum: number; count: number }>()
    for (const a of scored) {
      const entry = byClass.get(a.student_class) || { sum: 0, count: 0 }
      entry.sum += a.total_score as number
      entry.count += 1
      byClass.set(a.student_class, entry)
    }

    const levelGrades = teacherSchoolLevel
      ? grades.filter((g) => g.school_level === teacherSchoolLevel).sort((a, b) => a.grade_id - b.grade_id)
      : []

    if (levelGrades.length > 0) {
      return levelGrades.map((g) => {
        const entry = byClass.get(g.grade_name)
        return { class_name: g.grade_name, avg_score: entry ? Math.round(entry.sum / entry.count) : 0 }
      })
    }

    return Array.from(byClass.entries())
      .map(([class_name, { sum, count }]) => ({ class_name, avg_score: Math.round(sum / count) }))
      .sort((a, b) => a.class_name.localeCompare(b.class_name, 'id', { numeric: true }))
  }, [attempts, grades, teacherSchoolLevel])

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

          {fetching ? (
            <div style={{
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              padding: 80, color: '#9ca3af'
            }}>
              <Loader2 className="animate-spin" width={28} height={28} />
            </div>
          ) : (
            <div className="mb-6 mt-2">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard
                  icon={<BookOpen className="w-5 h-5 text-primary" />}
                  value={stats.totalQuizzes}
                  label="Total Kuis Dibuat"
                  href="/teacher/quizzes"
                />
                <StatCard
                  icon={<UsersIcon className="w-5 h-5 text-blue-600" />}
                  value={stats.uniqueStudents}
                  label="Siswa Unik"
                  href="/teacher/students"
                />
                <StatCard
                  icon={<Hourglass className="w-5 h-5 text-amber-600" />}
                  value={stats.pendingReview}
                  label="Kuis Perlu Dikoreksi"
                  href="/teacher/scores?status=pending"
                />
              </div>

              {stats.totalAttempts === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 mt-4">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Belum ada siswa yang mengerjakan</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Statistik akan terisi setelah siswa mulai mengumpulkan kuis Anda.
                    </p>
                  </div>
                </div>
              )}

              {classAverages.length > 0 && (
                <div className="bg-white rounded-2xl border border-border p-4 mt-4">
                  <p className="text-sm font-semibold text-foreground mb-3">
                    Rata-rata Nilai per Kelas{teacherSchoolLevel ? ` (${teacherSchoolLevel})` : ""}
                  </p>
                  <div style={{ width: '100%', height: 240 }}>
                    <ResponsiveContainer>
                      <BarChart data={classAverages} margin={{ top: 24, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="class_name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          formatter={(value: number) => [`${value}%`, 'Rata-rata']}
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                        />
                        <Bar dataKey="avg_score" fill="#f5a623" radius={[6, 6, 0, 0]}>
                          <LabelList
                            dataKey="avg_score"
                            position="top"
                            formatter={(value: number) => `${value}%`}
                            style={{ fontSize: 11, fontWeight: 600, fill: '#374151' }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <ChatbotWidget />
    </div>
  )
}
