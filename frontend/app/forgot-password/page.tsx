"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import "@/styles/otp.css"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || "Gagal mengirim kode. Coba lagi.")
        setIsLoading(false)
        return
      }

      router.push(`/reset-password?email=${encodeURIComponent(email)}`)
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
        <form onSubmit={handleSubmit} className="otp-card otp-form fade-in">
          <h2 className="otp-title">Lupa Kata Sandi</h2>
          <p className="otp-subtitle">
            Masukkan email akun Anda. Kami kirimkan kode 6 digit untuk membuat kata sandi baru.
          </p>

          <div className="otp-field-block">
            <label className="otp-field-label">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Masukan email terdaftar"
              className="otp-field-input"
            />
          </div>

          {error && <div className="otp-error">{error}</div>}

          <button type="submit" disabled={isLoading || !email} className="otp-submit-btn">
            {isLoading ? <span className="otp-spinner" /> : null}
            {isLoading ? "Mengirim..." : "Kirim Kode"}
          </button>

          <p className="otp-subtitle" style={{ marginTop: 16 }}>
            Ingat kata sandi Anda? <Link href="/login">Kembali ke halaman masuk</Link>
          </p>
        </form>
      </div>
    </div>
  )
}