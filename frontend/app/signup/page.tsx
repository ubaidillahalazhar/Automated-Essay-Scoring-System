"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"
import "@/styles/signup.css"

type Step = 1 | 2 | 3 | 4 | 5

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Grade {
  grade_id: number
  grade_name: string
  school_level: string
}

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
  const [schoolLevel, setSchoolLevel]         = useState<string>("SD")
  const [gradeId, setGradeId]                 = useState<number | null>(null)
  const [joinCommunity, setJoinCommunity]     = useState(false)
  const [birthDay, setBirthDay]               = useState("11")
  const [birthMonth, setBirthMonth]           = useState("September")
  const [birthYear, setBirthYear]             = useState("2010")
  const [error, setError]                     = useState("")
  const [isLoading, setIsLoading]             = useState(false)

  const [grades, setGrades] = useState<Grade[]>([])
  const [loadingGrades, setLoadingGrades] = useState(false)

  const months = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember",
  ]

  useEffect(() => {
    if (role !== "student" || grades.length > 0) return

    let cancelled = false
    setLoadingGrades(true)

    fetch(`${BACKEND_URL}/api/grades`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data.data) setGrades(data.data)
      })
      .catch(err => console.error("Gagal memuat daftar kelas:", err))
      .finally(() => {
        if (!cancelled) setLoadingGrades(false)
      })

    return () => { cancelled = true }
  }, [role, grades.length])

  useEffect(() => {
    if (gradeId) {
      const current = grades.find(g => g.grade_id === gradeId)
      if (current && current.school_level !== schoolLevel) {
        setGradeId(null)
      }
    }
  }, [schoolLevel, gradeId, grades])

  const gradesByLevel = grades.filter(g => g.school_level === schoolLevel)

  function next() { setError(""); setStep((s) => (s + 1) as Step) }
  function back() { setError(""); setStep((s) => (s - 1) as Step) }

  function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    if (!email) { setError("Email wajib diisi."); return }
    if (!agree) { setError("Anda harus menyetujui syarat & ketentuan."); return }
    next()
  }

  function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    if (!username) { setError("Username wajib diisi."); return }
    if (password.length < 6) { setError("Kata sandi minimal 6 karakter."); return }
    if (password !== confirmPassword) { setError("Konfirmasi kata sandi tidak cocok."); return }
    next()
  }

  function handleStep3(e: React.FormEvent) {
    e.preventDefault()
    if (role === "student" && !gradeId) {
      setError("Silakan pilih kelasmu untuk melanjutkan.")
      return
    }
    next()
  }

  function handleStep4(e: React.FormEvent) {
    e.preventDefault()
    next()
  }

  async function handleStep5(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    await new Promise((r) => setTimeout(r, 500))

    // grade_id dikirim langsung ke backend; tidak perlu localStorage lagi
    const result = await signup(
      username,
      email,
      password,
      role,
      role === "student" && gradeId
        ? grades.find(g => g.grade_id === gradeId)?.grade_name
        : undefined,
      role === "student" && gradeId ? gradeId : undefined
    )

    if (!result.success) {
      setError(result.message)
      setIsLoading(false)
    } else {
      router.push(`/verify-otp?email=${encodeURIComponent(email)}`)
    }
  }

  return (
    <div className="signup-page">
      <div className="signup-bg">
        <Image src="/background.png" alt="" fill priority className="signup-bg-img" />
      </div>

      <nav className="signup-nav">
        <Image src="/logo kejarcita.png" alt="Kejarcita" width={160} height={48} className="signup-logo" priority />
        <div className="signup-nav-right">
          <span className="signup-nav-label">Punya akun?</span>
          <Link href="/login" className="signup-nav-btn">Masuk di sini</Link>
        </div>
      </nav>

      <div className="signup-content">
        <div className="signup-kid signup-kid--left">
          <Image src="/kidz 1.png" alt="" fill className="signup-kid-img" />
        </div>

        <div className="signup-card fade-in" key={step}>

          {step === 1 && (
            <form onSubmit={handleStep1} className="signup-form">
              <h1 className="signup-title">Kami senang menyambutmu!</h1>
              <p className="signup-subtitle">Daftar gratis dengan email</p>

              <div className="signup-field">
                <label className="signup-label">Email</label>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="Input Email" required className="signup-input"
                />
              </div>

              <label className="signup-agree">
                <input
                  type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)}
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
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleStep2} className="signup-form">
              <div className="signup-field">
                <label className="signup-label">Username</label>
                <input
                  type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="username" required className="signup-input"
                />
              </div>

              <div className="signup-field">
                <label className="signup-label">Kata Sandi</label>
                <div className="signup-input-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    required className="signup-input signup-input--password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="signup-eye-btn">
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                <span className="signup-hint">Minimal 6 karakter</span>
              </div>

              <div className="signup-field">
                <label className="signup-label">Konfirmasi Kata Sandi</label>
                <input
                  type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Konfirmasi Kata Sandi" required className="signup-input"
                />
              </div>

              {error && <div className="signup-error">{error}</div>}

              <div className="signup-btn-row">
                <button type="button" onClick={back} className="signup-back-btn">Kembali</button>
                <button type="submit" className="signup-submit-btn signup-submit-btn--flex">Selanjutnya</button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleStep3} className="signup-form">
              <h2 className="signup-title signup-title--center">Saya adalah...</h2>

              <div className="signup-role-row">
                {(["student", "teacher"] as const).map((r) => (
                  <button
                    key={r} type="button" onClick={() => setRole(r)}
                    className={`signup-role-card ${role === r ? "signup-role-card--active" : ""}`}
                  >
                    <div className="signup-role-img-wrap">
                      <Image
                        src={r === "student" ? "/role siswa.png" : "/role guru.png"}
                        alt={r} width={120} height={120} className="signup-role-img"
                      />
                    </div>
                    <span className="signup-role-label">{r === "student" ? "Siswa" : "Guru"}</span>
                  </button>
                ))}
              </div>

              {role === "student" && (
                <>
                  <div className="signup-field" style={{ marginTop: 16 }}>
                    <label className="signup-label">Jenjang Sekolah</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(["SD", "SMP", "SMA"] as const).map(lvl => (
                        <button
                          key={lvl} type="button"
                          onClick={() => setSchoolLevel(lvl)}
                          className="signup-input"
                          style={{
                            cursor: 'pointer', flex: 1, textAlign: 'center',
                            fontWeight: schoolLevel === lvl ? 700 : 400,
                            background: schoolLevel === lvl ? '#fef3e2' : '#fff',
                            borderColor: schoolLevel === lvl ? '#f5a623' : '#e5e7eb',
                          }}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="signup-field">
                    <label className="signup-label">Kelas</label>
                    <select
                      value={gradeId || ""}
                      onChange={(e) => setGradeId(e.target.value ? parseInt(e.target.value) : null)}
                      required className="signup-input"
                    >
                      <option value="">
                        {loadingGrades ? "Memuat..." : `-- Pilih kelas ${schoolLevel} --`}
                      </option>
                      {gradesByLevel.map(g => (
                        <option key={g.grade_id} value={g.grade_id}>{g.grade_name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {role === "teacher" && (
                <label className="signup-agree signup-agree--small">
                  <input
                    type="checkbox" checked={joinCommunity}
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

          {step === 4 && (
            <form onSubmit={handleStep4} className="signup-form">
              <h2 className="signup-title signup-title--center">Berapa usia kamu?</h2>

              <div className="signup-dob-row">
                <input
                  type="number" value={birthDay} onChange={(e) => setBirthDay(e.target.value)}
                  min="1" max="31"
                  className="signup-input signup-input--dob signup-input--dob-day"
                />
                <select
                  value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)}
                  className="signup-input signup-input--dob signup-input--dob-month"
                >
                  {months.map((m) => (<option key={m} value={m}>{m}</option>))}
                </select>
                <input
                  type="number" value={birthYear} onChange={(e) => setBirthYear(e.target.value)}
                  // min="999999" max="999"
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

          {step === 5 && (
            <form onSubmit={handleStep5} className="signup-form">
              <h2 className="signup-title signup-title--center">Siap untuk memulai?</h2>
              <p className="signup-subtitle signup-subtitle--center">
                Klik "Daftar Sekarang" untuk membuat akunmu dan mulai belajar bersama Kejarcita!
              </p>

              <div className="signup-summary">
                <div className="signup-summary-row">
                  <span className="signup-summary-key">Email: </span>
                  <span className="signup-summary-val">{email}</span>
                </div>
                <div className="signup-summary-row">
                  <span className="signup-summary-key">Username: </span>
                  <span className="signup-summary-val">{username}</span>
                </div>
                <div className="signup-summary-row">
                  <span className="signup-summary-key">Peran: </span>
                  <span className="signup-summary-val">{role === "student" ? "Siswa" : "Guru"}</span>
                </div>
                {role === "student" && gradeId && (
                  <div className="signup-summary-row">
                    <span className="signup-summary-key">Kelas: </span>
                    <span className="signup-summary-val">
                      {grades.find(g => g.grade_id === gradeId)?.grade_name} ({schoolLevel})
                    </span>
                  </div>
                )}
                <div className="signup-summary-row">
                  <span className="signup-summary-key">Tanggal lahir: </span>
                  <span className="signup-summary-val">{birthDay} {birthMonth} {birthYear}</span>
                </div>
              </div>

              {error && <div className="signup-error">{error}</div>}

              <div className="signup-btn-row">
                <button type="button" onClick={back} className="signup-back-btn">Kembali</button>
                <button type="submit" disabled={isLoading} className="signup-submit-btn signup-submit-btn--flex">
                  {isLoading ? "Mendaftarkan..." : "Daftar Sekarang"}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}
