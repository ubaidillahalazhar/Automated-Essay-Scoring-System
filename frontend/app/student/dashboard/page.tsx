"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"
import {
  getStoredQuizzes, getStoredAttempts,
  type Quiz, type QuizAttempt
} from "@/lib/store"
import "@/styles/student-dashboard.css"

// ─── Mini sparkline chart ─────────────────────────────────────────────────────
function SparklineChart({ attempts }: { attempts: QuizAttempt[] }) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May"]
  const now = new Date()

  const data = months.map((_, i) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (4 - i), 1)
    const m = month.getMonth()
    const y = month.getFullYear()
    const rel = attempts.filter((a) => {
      const d = new Date(a.completedAt)
      return d.getMonth() === m && d.getFullYear() === y
    })
    if (!rel.length) return null
    return Math.round(rel.reduce((s, a) => s + (a.totalScore / a.maxScore) * 100, 0) / rel.length)
  })

  const valid = data.filter((d) => d !== null) as number[]
  const max = valid.length ? Math.max(...valid) : 100
  const min = valid.length ? Math.min(...valid) : 0
  const range = max - min || 1
  const W = 200, H = 60, pad = 10

  const pts = data.map((v, i) => ({
    x: pad + (i / (months.length - 1)) * (W - pad * 2),
    y: v === null ? null : H - pad - ((v - min) / range) * (H - pad * 2),
    v,
  }))

  const pathD = pts
    .filter((p) => p.y !== null)
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ")

  return (
    <div className="sd-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="sd-chart-svg">
        {pathD ? (
          <>
            <path d={pathD} fill="none" stroke="#f5a623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {pts.filter((p) => p.y !== null).map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y!} r="3" fill="#f5a623" />
            ))}
          </>
        ) : (
          <text x={W / 2} y={H / 2 + 4} textAnchor="middle" fontSize="9" fill="#ccc">
            Belum ada data
          </text>
        )}
      </svg>
      <div className="sd-chart-months">
        {months.map((m) => <span key={m}>{m}</span>)}
      </div>
    </div>
  )
}

// ─── Student Dashboard ────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const { user, logout, isLoading } = useAuth()
  const router = useRouter()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])

  // ── Auth guard → redirect to login if not a student ──
  useEffect(() => {
    if (!isLoading && (!user || user.role !== "student")) {
      router.replace("/login")
    }
  }, [user, isLoading, router])

  useEffect(() => {
    setQuizzes(getStoredQuizzes())
    setAttempts(getStoredAttempts())
  }, [])

  if (isLoading || !user) return null

  // ── Derived state ──
  const myAttempts   = attempts.filter((a) => a.studentId === user.id)
  const available    = quizzes.filter((q) => q.isActive && q.class === user.class)
  const completedIds = new Set(myAttempts.map((a) => a.quizId))
  const pending      = available.filter((q) => !completedIds.has(q.id))
  const avgScore     = myAttempts.length
    ? Math.round(myAttempts.reduce((s, a) => s + (a.totalScore / a.maxScore) * 100, 0) / myAttempts.length)
    : 0
  const progress = available.length
    ? Math.min(100, Math.round((myAttempts.length / available.length) * 100))
    : 0

  const tutors = [
    { label: "Tutor 1", bg: "#f5a623" },
    { label: "Tutor 2", bg: "#e67e22" },
    { label: "Tutor 3", bg: "#27ae60" },
  ]

  return (
    <div className="sd-page">

      {/* ── Background ── */}
      <div className="sd-bg">
        <Image src="/background.png" alt="" fill priority className="sd-bg-img" />
      </div>

      {/* ── Navbar ── */}
      <nav className="sd-nav">
        <Image src="/logo kejarcita.png" alt="Kejarcita" width={150} height={44} className="sd-logo" priority />
        <div className="sd-search-box">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#aaa" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input type="text" placeholder="Cari..." className="sd-search-input" />
        </div>
        <div className="sd-nav-actions">
          <div className="sd-avatar">{user.name.charAt(0).toUpperCase()}</div>
          <button onClick={logout} className="sd-logout-btn">Keluar</button>
        </div>
      </nav>

      {/* ── Kid illustrations ── */}
      <div className="sd-kid sd-kid--left">
        <Image src="/kidz 1.png" alt="" fill className="sd-kid-img" />
      </div>
      <div className="sd-kid sd-kid--right">
        <Image src="/kidz 2.png" alt="" fill className="sd-kid-img" />
      </div>

      {/* ── Main content ── */}
      <main className="sd-main">

        {/* Welcome card */}
        <div className="sd-welcome fade-in">
          <h1 className="sd-welcome-title">
            Selamat Datang Kembali,{" "}
            <span className="sd-welcome-name">({user.name.split(" ")[0]})</span>!
          </h1>
          <p className="sd-welcome-sub">Siap untuk sesi belajar hari ini?</p>
          <div className="sd-progress-track">
            <div className="sd-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* 4-card grid */}
        <div className="sd-grid fade-in">

          {/* Pelatihan Saya */}
          <div className="sd-card">
            <h2 className="sd-card-title">Pelatihan Saya</h2>
            <div className="sd-course-row">
              <div className="sd-course-icon-wrap">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="#f5a623">
                  <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
                </svg>
              </div>
              <div>
                <p className="sd-course-name">Kourse Saya</p>
                <p className="sd-course-meta">{myAttempts.length} Summary</p>
              </div>
            </div>
            {pending.slice(0, 2).map((q) => (
              <Link key={q.id} href={`/student/quiz/${q.id}`} className="sd-pending-item">
                <span className="sd-pending-dot" />
                <span className="sd-pending-label">{q.title}</span>
                <span className="sd-pending-arrow">›</span>
              </Link>
            ))}
          </div>

          {/* Daftar Tutor */}
          <div className="sd-card">
            <h2 className="sd-card-title">Daftar Tutor</h2>
            <div className="sd-tutor-row">
              {tutors.map((t) => (
                <div key={t.label} className="sd-tutor">
                  <div className="sd-tutor-avatar" style={{ background: t.bg }}>
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="white">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M20 21a8 8 0 10-16 0" />
                    </svg>
                  </div>
                  <span className="sd-tutor-name">{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Arsip Nilai */}
          <div className="sd-card">
            <div className="sd-card-header">
              <h2 className="sd-card-title">Arsip Nilai</h2>
              {avgScore > 0 && <span className="sd-badge">Avg {avgScore}</span>}
            </div>
            <SparklineChart attempts={myAttempts} />
          </div>

          {/* Favorit */}
          <div className="sd-card">
            <h2 className="sd-card-title">Favorit</h2>
            <div className="sd-favorit">
              <svg viewBox="0 0 24 24" width="44" height="44" fill="#f5a623">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <p className="sd-favorit-text">Pilih soal yang kamu sukai</p>
            </div>
            {myAttempts.length > 0 && (
              <Link href="/student/results" className="sd-favorit-link">
                Lihat hasil terakhir →
              </Link>
            )}
          </div>

        </div>

        {/* Bottom arrow */}
        <div className="sd-bottom">
          <button className="sd-arrow-btn">→</button>
        </div>

      </main>
    </div>
  )
}