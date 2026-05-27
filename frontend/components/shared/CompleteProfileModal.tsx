"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Grade {
  grade_id: number
  grade_name: string
  school_level: string
}

/**
 * Modal "Lengkapi Profil" — otomatis tampil kalau user adalah siswa
 * yang grade_id-nya null. Render-kan di layout siswa atau dashboard.
 *
 * Setelah siswa pilih kelas, user state auto-update (via updateProfile
 * di auth-context) sehingga modal otomatis hilang.
 */
export function CompleteProfileModal() {
  const { user, updateProfile } = useAuth()
  const [grades, setGrades] = useState<Grade[]>([])
  const [schoolLevel, setSchoolLevel] = useState<string>("SD")
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>("")
  const [loadingGrades, setLoadingGrades] = useState(false)

  // Hanya tampil untuk siswa yang grade_id-nya null
  const shouldShow = user && user.role === "student" && !user.grade_id

  useEffect(() => {
    if (!shouldShow || grades.length > 0) return

    let cancelled = false
    setLoadingGrades(true)

    fetch(`${BACKEND_URL}/api/grades`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data.data) setGrades(data.data)
      })
      .catch(err => console.error("Gagal memuat grade:", err))
      .finally(() => {
        if (!cancelled) setLoadingGrades(false)
      })

    return () => { cancelled = true }
  }, [shouldShow, grades.length])

  if (!shouldShow) return null

  const gradesByLevel = grades.filter(g => g.school_level === schoolLevel)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedGradeId) {
      setError("Silakan pilih kelasmu.")
      return
    }
    setSaving(true)
    setError("")
    const result = await updateProfile(selectedGradeId)
    if (!result.success) {
      setError(result.message)
      setSaving(false)
    }
    // Kalau sukses, modal auto-hilang karena user.grade_id sudah ter-set
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
      <div className="bg-white rounded-2xl border border-border p-6 max-w-md w-full">
        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6 text-amber-600" />
        </div>

        <h2 className="text-xl font-bold text-foreground mb-2">
          Lengkapi Profilmu
        </h2>
        <p className="text-sm text-muted-foreground mb-5">
          Halo {user?.name?.split(" ")[0]}! Kami perlu tahu kelasmu untuk
          menampilkan kuis yang sesuai. Pilih kelas di bawah ini.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Jenjang Sekolah
            </label>
            <div className="flex gap-2">
              {(["SD", "SMP", "SMA"] as const).map(lvl => (
                <button
                  key={lvl} type="button"
                  onClick={() => {
                    setSchoolLevel(lvl)
                    setSelectedGradeId(null)
                  }}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                    schoolLevel === lvl
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground hover:bg-muted/70"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Kelas
            </label>
            <select
              value={selectedGradeId || ""}
              onChange={(e) => setSelectedGradeId(e.target.value ? parseInt(e.target.value) : null)}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">
                {loadingGrades ? "Memuat..." : `-- Pilih kelas ${schoolLevel} --`}
              </option>
              {gradesByLevel.map(g => (
                <option key={g.grade_id} value={g.grade_id}>{g.grade_name}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !selectedGradeId}
            className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? "Menyimpan..." : "Simpan & Lanjutkan"}
          </button>
        </form>
      </div>
    </div>
  )
}
