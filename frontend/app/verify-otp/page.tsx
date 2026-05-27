"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import "@/styles/otp.css"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function VerifyOtpPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const initialEmail = searchParams.get("email") || ""
    setEmail(initialEmail)
  }, [searchParams])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/verify-otp`, {
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

      alert("Verifikasi Sukses! Akun Anda telah aktif. Silakan login.");
      router.push("/login");
    } catch (err) {
      setError("Gagal terhubung ke server.")
      setIsLoading(false)
    }
  }

  return (
    <div className="otp-page">
      <div className="otp-bg">
        <Image src="/background.png" alt="" fill priority className="otp-bg-img" />
      </div>
      <div className="otp-content">
        <form onSubmit={handleVerify} className="otp-card otp-form fade-in">
          <h2 className="otp-title">Verifikasi Kode OTP</h2>
          <p className="otp-subtitle">Masukkan kode 6 digit yang dikirimkan ke email Anda.</p>

          <div className="otp-email-box">
            {email ? (
              <>Kode OTP dikirim ke <strong>{email}</strong></>
            ) : (
              <>Email belum ditemukan. Kembali ke pendaftaran dan buka halaman verifikasi dari sana.</>
            )}
          </div>

          <div className="otp-field-block">
            <label className="otp-field-label">Kode OTP</label>
            <input
              type="text" required maxLength={6}
              value={otp} onChange={(e) => setOtp(e.target.value)}
              className="otp-field-input"
            />
          </div>

          {error && <div className="otp-error">{error}</div>}

          <button type="submit" disabled={isLoading || !email} className="otp-submit-btn">
            {isLoading ? <span className="otp-spinner" /> : null}
            {isLoading ? "Memverifikasi..." : "Verifikasi Sekarang"}
          </button>
        </form>
      </div>
    </div>
  )
}
