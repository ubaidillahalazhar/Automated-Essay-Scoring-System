"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Cookies from "js-cookie";

export default function VerifyOtpPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      // Menembak ke endpoint verifikasi OTP di backend Anda
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify-otp`, {
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

      if (response.ok) {

  alert("Verifikasi Sukses! Akun Anda telah aktif. silakan login dengan email dan password yang sudah didaftarkan.");
 
  router.push("/login");
}
    } catch (err) {
      setError("Gagal terhubung ke server.")
      setIsLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f3f4f6' }}>
      <form onSubmit={handleVerify} style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 'bold' }}>Verifikasi Kode OTP</h2>
        <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#6b7280' }}>Masukkan email dan kode 6 digit yang dikirimkan ke email Anda.</p>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Email Anda</label>
          <input 
            type="email" required
            value={email} onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Kode OTP</label>
          <input 
            type="text" required maxLength={6}
            value={otp} onChange={(e) => setOtp(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '0.2rem' }}
          />
        </div>

        {error && <div style={{ color: 'red', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

        <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          {isLoading ? "Memverifikasi..." : "Verifikasi Sekarang"}
        </button>
      </form>
    </div>
  )
}