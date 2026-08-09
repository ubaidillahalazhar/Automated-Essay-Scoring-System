"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import "@/styles/otp.css"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [resetToken, setResetToken] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setEmail(searchParams.get("email") || "")
  }, [searchParams])

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setInfo("")
    setIsLoading(true)

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/verify-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || "Kode OTP salah atau kedaluwarsa.")
        setIsLoading(false)
        return
      }

      setResetToken(data.reset_token)
      setStep(2)
      setIsLoading(false)
    } catch (err) {
      setError("Gagal terhubung ke server.")
      setIsLoading(false)
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password.length < 6) {
      setError("Kata sandi baru minimal 6 karakter.")
      return
    }
    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok.")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, reset_token: resetToken, new_password: password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || "Gagal mengubah kata sandi.")
        setIsLoading(false)
        return
      }

      alert("Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru.")
      router.push("/login")
    } catch (err) {
      setError("Gagal terhubung ke server.")
      setIsLoading(false)
    }
  }

  async function handleResend() {
    setError("")
    setInfo("")
    setIsLoading(true)

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.message || "Gagal mengirim ulang kode.")
        setIsLoading(false)
        return
      }

      setInfo(data.message || "Kode baru sudah dikirim.")
      setOtp("")
    } catch (err) {
      setError("Gagal terhubung ke server.")
    }
    setIsLoading(false)
  }

  return (
    <div className="otp-page">
      <div className="otp-bg">
        <Image src="/background.png" alt="" fill priority className="otp-bg-img" />
      </div>

      <div className="otp-content">
        {step === 1 ? (
          <form onSubmit={handleVerifyOtp} className="otp-card otp-form fade-in">
            <h2 className="otp-title">Masukkan Kode Verifikasi</h2>
            <p className="otp-subtitle">Kami mengirim kode 6 digit ke email Anda.</p>

            <div className="otp-email-box">
              {email ? (
                <>Kode dikirim ke <strong>{email}</strong></>
              ) : (
                <>Email belum terisi. <Link href="/forgot-password">Mulai lagi dari sini</Link>.</>
              )}
            </div>

            <div className="otp-field-block">
              <label className="otp-field-label">Kode Verifikasi</label>
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="otp-field-input"
              />
            </div>

            {info && <div className="otp-email-box">{info}</div>}
            {error && <div className="otp-error">{error}</div>}

            <button type="submit" disabled={isLoading || !email} className="otp-submit-btn">
              {isLoading ? <span className="otp-spinner" /> : null}
              {isLoading ? "Memverifikasi..." : "Verifikasi"}
            </button>

            <p className="otp-subtitle" style={{ marginTop: 16 }}>
              Kode belum masuk?{" "}
              <button type="button" onClick={handleResend} disabled={isLoading || !email}>
                Kirim ulang kode
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="otp-card otp-form fade-in">
            <h2 className="otp-title">Buat Kata Sandi Baru</h2>
            <p className="otp-subtitle">Gunakan kata sandi yang belum pernah Anda pakai sebelumnya.</p>

            <div className="otp-field-block">
              <label className="otp-field-label">Kata Sandi Baru</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="otp-field-input"
              />
            </div>

            <div className="otp-field-block">
              <label className="otp-field-label">Konfirmasi Kata Sandi</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="otp-field-input"
              />
            </div>

            {error && <div className="otp-error">{error}</div>}

            <button type="submit" disabled={isLoading} className="otp-submit-btn">
              {isLoading ? <span className="otp-spinner" /> : null}
              {isLoading ? "Menyimpan..." : "Simpan Kata Sandi"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}