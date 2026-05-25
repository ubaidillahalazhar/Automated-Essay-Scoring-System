"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"
import "@/styles/signup.css"

type Step = 1 | 2 | 3 | 4 | 5

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

// ─── Main Signup Page ─────────────────────────────────────────────────────────
export default function SignupPage() {
  const { signup } = useAuth()
  const router = useRouter()

  const [step, setStep] = useState<Step>(1)
  const [email, setEmail]                     = useState("")
  const [phone, setPhone]                     = useState("")
  const [agree, setAgree]                     = useState(false)
  const [username, setUsername]               = useState("")
  const [password, setPassword]               = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword]       = useState(false)
  const [role, setRole]                       = useState<"student" | "teacher">("student")
  const [school, setSchool]                   = useState("")
  const [joinCommunity, setJoinCommunity]     = useState(false)
  const [birthDay, setBirthDay]               = useState("11")
  const [birthMonth, setBirthMonth]           = useState("September")
  const [birthYear, setBirthYear]             = useState("2010")
  const [error, setError]                     = useState("")
  const [isLoading, setIsLoading]             = useState(false)

  const months = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember",
  ]

  function next() { setError(""); setStep((s) => (s + 1) as Step) }
  function back() { setError(""); setStep((s) => (s - 1) as Step) }

  // Step 1 – email + phone
  function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    if (!email) { setError("Email wajib diisi."); return }
    if (!agree) { setError("Anda harus menyetujui syarat & ketentuan."); return }
    next()
  }

  // Step 2 – username + password
  function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    if (!username) { setError("Username wajib diisi."); return }
    if (password.length < 6) { setError("Kata sandi minimal 6 karakter."); return }
    if (password !== confirmPassword) { setError("Konfirmasi kata sandi tidak cocok."); return }
    next()
  }

  // Step 3 – role selection
  function handleStep3(e: React.FormEvent) {
    e.preventDefault()
    next()
  }

  // Step 4 – age / birthday
  function handleStep4(e: React.FormEvent) {
    e.preventDefault()
    next()
  }

  // Step 5 – final submit → redirect to login on success
  async function handleStep5(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    await new Promise((r) => setTimeout(r, 700))
    const result = await signup(username, email, password, role, school)
    if (!result.success) {
      setError(result.message)
      setIsLoading(false)
    } else {
      // ✅ Signup berhasil → lanjut ke verifikasi OTP dengan email yang sudah didaftarkan
      router.push(`/verify-otp?email=${encodeURIComponent(email)}`)
    }
  }

  return (
    <div className="signup-page">

      {/* Background */}
      <div className="signup-bg">
        <Image src="/background.png" alt="" fill priority className="signup-bg-img" />
      </div>

      {/* Navbar */}
      <nav className="signup-nav">
        <Image
          src="/logo kejarcita.png"
          alt="Kejarcita"
          width={160}
          height={48}
          className="signup-logo"
          priority
        />
        <div className="signup-nav-right">
          <span className="signup-nav-label">Punya akun?</span>
          <Link href="/login" className="signup-nav-btn">Masuk di sini</Link>
        </div>
      </nav>

      {/* Content */}
      <div className="signup-content">

        {/* Left kids */}
        <div className="signup-kid signup-kid--left">
          <Image src="/kidz 1.png" alt="" fill className="signup-kid-img" />
        </div>

        {/* Card — key={step} triggers fade-in on each step change */}
        <div className="signup-card fade-in" key={step}>

          {/* ── STEP 1: Email & Phone ── */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="signup-form">
              <h1 className="signup-title">Kami senang menyambutmu!</h1>
              <p className="signup-subtitle">Daftar gratis dengan email</p>

              <div className="signup-field">
                <label className="signup-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Input Email"
                  required
                  className="signup-input"
                />
              </div>

              <label className="signup-agree">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="signup-checkbox"
                />
                <span>
                  Dengan mendaftar, Anda menyetujui{" "}
                  <a href="#" className="signup-link">Syarat &amp; Ketentuan</a>
                  , termasuk penggunaan data untuk keperluan promosi dan pemasaran.
                </span>
              </label>

              {error && <div className="signup-error">{error}</div>}

              <button type="submit" className="signup-submit-btn">Selanjutnya</button>

              <p className="signup-login-row">
                Sudah menjadi anggota?{" "}
                <Link href="/login" className="signup-link">Masuk</Link>
              </p>
              <button type="button" className="signup-link-btn">
                Apakah Anda tidak menerima instruksi cara melakukan konfirmasi?
              </button>
            </form>
          )}

          {/* ── STEP 2: Username & Password ── */}
          {step === 2 && (
            <form onSubmit={handleStep2} className="signup-form">
              <div className="signup-field">
                <label className="signup-label">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  required
                  className="signup-input"
                />
              </div>

              <div className="signup-field">
                <label className="signup-label">Kata Sandi</label>
                <div className="signup-input-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder=""
                    required
                    className="signup-input signup-input--password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="signup-eye-btn"
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                <span className="signup-hint">Minimal 6 karakter</span>
              </div>

              <div className="signup-field">
                <label className="signup-label">Konfirmasi Kata Sandi</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Konfirmasi Kata Sandi"
                  required
                  className="signup-input"
                />
              </div>

              {error && <div className="signup-error">{error}</div>}

              <div className="signup-btn-row">
                <button type="button" onClick={back} className="signup-back-btn">Kembali</button>
                <button type="submit" className="signup-submit-btn signup-submit-btn--flex">Selanjutnya</button>
              </div>
            </form>
          )}

          {/* ── STEP 3: Role selection ── */}
          {step === 3 && (
            <form onSubmit={handleStep3} className="signup-form">
              <h2 className="signup-title signup-title--center">Saya adalah...</h2>

              <div className="signup-role-row">
                {(["student", "teacher"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`signup-role-card ${role === r ? "signup-role-card--active" : ""}`}
                  >
                    <div className="signup-role-img-wrap">
                      <Image
                        src={r === "student" ? "/role siswa.png" : "/role guru.png"}
                        alt={r}
                        width={120}
                        height={120}
                        className="signup-role-img"
                      />
                    </div>
                    <span className="signup-role-label">{r === "student" ? "Siswa" : "Guru"}</span>
                  </button>
                ))}
              </div>

              {role === "student" && (
                <div className="signup-field">
                  <input
                    type="text"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    placeholder="saat ini belajar di"
                    className="signup-input"
                  />
                </div>
              )}
              {role === "teacher" && (
                <label className="signup-agree signup-agree--small">
                  <input
                    type="checkbox"
                    checked={joinCommunity}
                    onChange={(e) => setJoinCommunity(e.target.checked)}
                    className="signup-checkbox"
                  />
                  <span>Gabung Komunitas Gurucita</span>
                </label>
              )}

              {error && <div className="signup-error">{error}</div>}

              <div className="signup-btn-row">
                <button type="button" onClick={back} className="signup-back-btn">Kembali</button>
                <button type="submit" className="signup-submit-btn signup-submit-btn--flex">Selanjutnya</button>
              </div>
            </form>
          )}

          {/* ── STEP 4: Age / Birthday ── */}
          {step === 4 && (
            <form onSubmit={handleStep4} className="signup-form">
              <h2 className="signup-title signup-title--center">Berapa usia kamu?</h2>

              <div className="signup-dob-row">
                <input
                  type="number"
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                  min="1"
                  max="31"
                  className="signup-input signup-input--dob signup-input--dob-day"
                />
                <select
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                  className="signup-input signup-input--dob signup-input--dob-month"
                >
                  {months.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  min="1990"
                  max="2020"
                  className="signup-input signup-input--dob signup-input--dob-year"
                />
              </div>

              {error && <div className="signup-error">{error}</div>}

              <div className="signup-btn-row">
                <button type="button" onClick={back} className="signup-back-btn">Kembali</button>
                <button type="submit" className="signup-submit-btn signup-submit-btn--flex">Selanjutnya</button>
              </div>
            </form>
          )}

          {/* ── STEP 5: Confirm & Submit ── */}
          {step === 5 && (
            <form onSubmit={handleStep5} className="signup-form">
              <h2 className="signup-title signup-title--center">Siap untuk memulai?</h2>
              <p className="signup-subtitle signup-subtitle--center">
                Klik "Daftar Sekarang" untuk membuat akunmu dan mulai belajar bersama Kejarcita!
              </p>

              {/* Summary */}
              <div className="signup-summary">
                <div className="signup-summary-row">
                  <span className="signup-summary-key">Email</span>
                  <span className="signup-summary-val">{email}</span>
                </div>
                <div className="signup-summary-row">
                  <span className="signup-summary-key">Username</span>
                  <span className="signup-summary-val">{username}</span>
                </div>
                <div className="signup-summary-row">
                  <span className="signup-summary-key">Peran</span>
                  <span className="signup-summary-val">{role === "student" ? "Siswa" : "Guru"}</span>
                </div>
                <div className="signup-summary-row">
                  <span className="signup-summary-key">Tanggal lahir</span>
                  <span className="signup-summary-val">{birthDay} {birthMonth} {birthYear}</span>
                </div>
              </div>

              {error && <div className="signup-error">{error}</div>}

              <div className="signup-btn-row">
                <button type="button" onClick={back} className="signup-back-btn">Kembali</button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="signup-submit-btn signup-submit-btn--flex"
                >
                  {isLoading ? (
                    <><div className="signup-spinner" /> Memuat...</>
                  ) : (
                    "Daftar Sekarang"
                  )}
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Right kids */}
        <div className="signup-kid signup-kid--right">
          <Image src="/kidz 2.png" alt="" fill className="signup-kid-img" />
        </div>

      </div>
    </div>
  )
}