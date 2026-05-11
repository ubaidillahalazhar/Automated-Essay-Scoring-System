"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"
import { MOCK_USERS } from "@/lib/store"
import "@/styles/login.css"

// ─── Eye Icons ────────────────────────────────────────────────────────────────
function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

// ─── Main Login Page ──────────────────────────────────────────────────────────
export default function LoginPage() {
  const { login, user, isLoading } = useAuth()
  const router = useRouter()

  const [email, setEmail]               = useState("")
  const [password, setPassword]         = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember]         = useState(false)
  const [error, setError]               = useState("")
  const [submitting, setSubmitting]     = useState(false)

  // ── Auto-redirect if already logged in (e.g. stored session) ─────────────
  useEffect(() => {
    if (!isLoading && user) {
      router.replace(
        user.role === "student" ? "/student/dashboard" : "/teacher/dashboard"
      )
    }
  }, [user, isLoading, router])

  // ── Handle form submit ────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSubmitting(true)

    await new Promise((r) => setTimeout(r, 500))

    const result = await login(email, password)

    if (!result.success) {
      setError(result.message)
      setSubmitting(false)
      return
    }

    // ✅ Find role from MOCK_USERS directly (user state not updated yet this render)
    const found = MOCK_USERS.find((u) => u.email === email)
    const dest  = found?.role === "student" ? "/student/dashboard" : "/teacher/dashboard"
    router.push(dest)
  }

  function fillDemo(role: "student" | "teacher") {
    if (role === "student") {
      setEmail("budi@student.com")
      setPassword("password123")
    } else {
      setEmail("dewi@guru.com")
      setPassword("password123")
    }
  }

  // Show nothing while auth state is loading from storage
  if (isLoading) return null

  return (
    <div className="login-page">

      {/* ── Background image ── */}
      <div className="login-bg">
        <Image src="/background.png" alt="" priority fill className="login-bg-img" />
      </div>

      {/* ── Navbar ── */}
      <nav className="login-nav">
        <Image src="/logo kejarcita.png" alt="Kejarcita" width={160} height={48} className="login-logo" priority />
        <div className="login-nav-right">
          <span className="login-nav-label">Punya akun?</span>
          <Link href="/login" className="login-nav-btn">Masuk di sini</Link>
        </div>
      </nav>

      {/* ── Main content ── */}
      <div className="login-content">

        {/* Left kids */}
        <div className="login-kid login-kid--left">
          <Image src="/kidz 1.png" alt="" fill className="login-kid-img" />
        </div>

        {/* ── Card ── */}
        <div className="login-card fade-in">
          <h1 className="login-title">
            Hai!<br />Selamat datang kembali!
          </h1>

          <form onSubmit={handleSubmit} className="login-form">

            {/* Email */}
            <div className="login-field">
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Masukan email/username"
                required
                className="login-input"
              />
            </div>

            {/* Password */}
            <div className="login-field login-field--password">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukan kata sandi"
                required
                className="login-input"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="login-eye-btn">
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            {/* Remember me */}
            <label className="login-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="login-checkbox"
              />
              Ingat saya
            </label>

            {/* Error */}
            {error && <div className="login-error">{error}</div>}

            {/* Submit */}
            <button type="submit" disabled={submitting} className="login-submit-btn">
              {submitting ? (
                <><div className="login-spinner" /> Memuat...</>
              ) : (
                "Masuk"
              )}
            </button>

            {/* Register row */}
            <div className="login-register-row">
              <span className="login-register-label">Bukan anggota?</span>
              <Link href="/signup" className="login-register-btn">Daftar Gratis</Link>
            </div>

            {/* Links */}
            <div className="login-links">
              <button type="button" className="login-link-btn">Lupa kata sandi?</button>
              <button type="button" className="login-link-btn">
                Apakah Anda tidak menerima instruksi cara melakukan konfirmasi?
              </button>
            </div>

            {/* Demo buttons */}
            <div className="login-demo-row">
              <button type="button" onClick={() => fillDemo("student")} className="login-demo-btn">
                🎒 Demo Siswa
              </button>
              <button type="button" onClick={() => fillDemo("teacher")} className="login-demo-btn">
                📚 Demo Guru
              </button>
            </div>

          </form>
        </div>

        {/* Right kids */}
        <div className="login-kid login-kid--right">
          <Image src="/kidz 2.png" alt="" fill className="login-kid-img" />
        </div>

      </div>
    </div>
  )
}