"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/shared/sidebar"
import {
  User, Pencil, BarChart3, Settings, Loader2,
  CheckCircle2, AlertCircle, X, Save, Eye, EyeOff,
  Trophy, TrendingUp, Award, Target, BookOpen, Users as UsersIcon,
  LogOut, Mail, GraduationCap, Calendar
} from "lucide-react"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

type TabId = "profile" | "edit" | "stats" | "settings"

interface TabConfig {
  id: TabId
  label: string
  icon: React.ReactNode
}

const TABS: TabConfig[] = [
  { id: "profile",  label: "Profile",       icon: <User className="w-4 h-4" /> },
  { id: "edit",     label: "Edit Profile",  icon: <Pencil className="w-4 h-4" /> },
  { id: "stats",    label: "Statistik",     icon: <BarChart3 className="w-4 h-4" /> },
  { id: "settings", label: "Pengaturan",    icon: <Settings className="w-4 h-4" /> },
]

interface Grade {
  grade_id: number
  grade_name: string
  school_level: string
}

interface StudentStats {
  totalAttempts: number
  avgScore: number
  bestScore: number
  subjectStats: Array<{ subject_name: string; avgScore: number; count: number }>
}

interface TeacherStats {
  totalQuizzes: number
  totalAttempts: number
  uniqueStudents: number
  avgClassScore: number
}

export default function ProfilePage() {
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>("profile")

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login")
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:p-8 p-4 pt-16 lg:pt-8 overflow-y-auto">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Profil Saya</h1>
          <p className="text-muted-foreground">Kelola informasi akun dan pengaturan kamu.</p>
        </div>

        {/* Layout: sub-sidebar kiri + konten kanan */}
        <div className="grid lg:grid-cols-[240px_1fr] gap-6">
          {/* Sub-sidebar */}
          <aside className="bg-white rounded-2xl border border-border p-3 h-fit">
            <nav className="space-y-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Konten */}
          <div>
            {activeTab === "profile" && <ProfileTab />}
            {activeTab === "edit" && <EditProfileTab />}
            {activeTab === "stats" && <StatsTab />}
            {activeTab === "settings" && <SettingsTab onLogout={logout} />}
          </div>
        </div>
      </main>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// TAB 1: PROFILE (read-only)
// ═════════════════════════════════════════════════════════════════
function ProfileTab() {
  const { user } = useAuth()
  if (!user) return null

  const initials = user.name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase()
  const roleLabel = user.role === "teacher" ? "Guru" : user.role === "student" ? "Siswa" : "Admin"

  return (
    <div className="bg-white rounded-2xl border border-border p-6">
      {/* Avatar + nama */}
      <div className="flex items-center gap-5 mb-8 pb-6 border-b border-border">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl font-bold text-white">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-foreground mb-1">{user.name}</h2>
          <p className="text-sm text-muted-foreground mb-2">{user.email}</p>
          <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
            {roleLabel}
          </span>
        </div>
      </div>

      {/* Info detail */}
      <div className="space-y-4">
        <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={user.email} />
        <InfoRow icon={<User className="w-4 h-4" />} label="Nama Lengkap" value={user.name} />
        <InfoRow icon={<UsersIcon className="w-4 h-4" />} label="Peran" value={roleLabel} />

        {user.role === "student" && (
          <InfoRow
            icon={<GraduationCap className="w-4 h-4" />}
            label="Kelas"
            value={
              user.grade_name
                ? `${user.grade_name}${user.school_level ? ` (${user.school_level})` : ""}`
                : "Belum diatur"
            }
          />
        )}

        {user.role === "teacher" && user.teaching_level && (
          <InfoRow
            icon={<GraduationCap className="w-4 h-4" />}
            label="Jenjang Mengajar"
            value={user.teaching_level}
          />
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-muted/30">
      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-muted-foreground flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-foreground truncate">{value}</p>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// TAB 2: EDIT PROFILE (inline edit)
// ═════════════════════════════════════════════════════════════════
function EditProfileTab() {
  const { user, updateProfile } = useAuth()
  const [editingName, setEditingName] = useState(false)
  const [editingGrade, setEditingGrade] = useState(false)
  const [nameValue, setNameValue] = useState(user?.name || "")
  const [gradeId, setGradeId] = useState<number | null>(user?.grade_id || null)
  const [schoolLevel, setSchoolLevel] = useState<string>(user?.school_level || "SD")
  const [grades, setGrades] = useState<Grade[]>([])
  const [loadingGrades, setLoadingGrades] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    if (user) {
      setNameValue(user.name)
      setGradeId(user.grade_id || null)
      setSchoolLevel(user.school_level || "SD")
    }
  }, [user])

  // Fetch grades saat butuh
  useEffect(() => {
    if (!editingGrade || grades.length > 0) return
    setLoadingGrades(true)
    fetch(`${BACKEND_URL}/api/grades`)
      .then(r => r.json())
      .then(data => { if (data.data) setGrades(data.data) })
      .catch(err => console.error("Gagal memuat grade:", err))
      .finally(() => setLoadingGrades(false))
  }, [editingGrade, grades.length])

  if (!user) return null

  async function handleSaveName() {
    if (!nameValue.trim()) {
      setMessage({ type: "error", text: "Nama tidak boleh kosong." })
      return
    }
    if (nameValue.trim() === user!.name) {
      setEditingName(false)
      return
    }
    setSaving(true)
    setMessage(null)
    const result = await updateProfile({ name: nameValue.trim() })
    setSaving(false)
    if (result.success) {
      setMessage({ type: "success", text: result.message })
      setEditingName(false)
    } else {
      setMessage({ type: "error", text: result.message })
    }
  }

  async function handleSaveGrade() {
    if (!gradeId) {
      setMessage({ type: "error", text: "Pilih kelas terlebih dulu." })
      return
    }
    setSaving(true)
    setMessage(null)
    const result = await updateProfile({ grade_id: gradeId })
    setSaving(false)
    if (result.success) {
      setMessage({ type: "success", text: result.message })
      setEditingGrade(false)
    } else {
      setMessage({ type: "error", text: result.message })
    }
  }

  function handleCancelName() {
    setNameValue(user!.name)
    setEditingName(false)
    setMessage(null)
  }

  function handleCancelGrade() {
    setGradeId(user!.grade_id || null)
    setSchoolLevel(user!.school_level || "SD")
    setEditingGrade(false)
    setMessage(null)
  }

  const gradesByLevel = grades.filter(g => g.school_level === schoolLevel)

  return (
    <div className="bg-white rounded-2xl border border-border p-6">
      <h2 className="text-lg font-bold text-foreground mb-1">Edit Profil</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Klik tombol "Edit" untuk mengubah informasi.
      </p>

      {message && (
        <div className={`mb-5 p-3 rounded-xl flex items-start gap-2 text-sm ${
          message.type === "success"
            ? "bg-green-50 border border-green-200 text-green-800"
            : "bg-red-50 border border-red-200 text-red-800"
        }`}>
          {message.type === "success"
            ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          {message.text}
        </div>
      )}

      <div className="space-y-5">
        {/* Edit Nama */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Nama Lengkap
          </label>
          {editingName ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Nama lengkap"
                autoFocus
              />
              <button
                onClick={handleSaveName}
                disabled={saving}
                className="px-3 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Simpan
              </button>
              <button
                onClick={handleCancelName}
                disabled={saving}
                className="px-3 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-muted/30">
              <span className="text-sm font-semibold text-foreground">{user.name}</span>
              <button
                onClick={() => setEditingName(true)}
                className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
            </div>
          )}
        </div>

        {/* Edit Kelas (hanya untuk siswa) */}
        {user.role === "student" && (
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Kelas
            </label>
            {editingGrade ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {(["SD", "SMP", "SMA"] as const).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => { setSchoolLevel(lvl); setGradeId(null) }}
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
                <select
                  value={gradeId || ""}
                  onChange={(e) => setGradeId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 rounded-xl border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">
                    {loadingGrades ? "Memuat..." : `-- Pilih kelas ${schoolLevel} --`}
                  </option>
                  {gradesByLevel.map(g => (
                    <option key={g.grade_id} value={g.grade_id}>{g.grade_name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveGrade}
                    disabled={saving || !gradeId}
                    className="flex-1 px-3 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Simpan
                  </button>
                  <button
                    onClick={handleCancelGrade}
                    disabled={saving}
                    className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-muted/30">
                <span className="text-sm font-semibold text-foreground">
                  {user.grade_name
                    ? `${user.grade_name} (${user.school_level || "-"})`
                    : "Belum diatur"}
                </span>
                <button
                  onClick={() => setEditingGrade(true)}
                  className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              </div>
            )}
          </div>
        )}

        {/* Email (tidak bisa diedit) */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Email
          </label>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/30">
            <span className="text-sm font-semibold text-muted-foreground flex-1">{user.email}</span>
            <span className="text-[10px] font-medium text-muted-foreground italic">
              tidak dapat diubah
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// TAB 3: STATISTIK
// ═════════════════════════════════════════════════════════════════
function StatsTab() {
  const { user } = useAuth()
  if (!user) return null

  return user.role === "student" ? <StudentStatsView /> : <TeacherStatsView />
}

function StudentStatsView() {
  const { user } = useAuth()
  const [stats, setStats] = useState<StudentStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const userId = user.id
    fetch(`${BACKEND_URL}/api/exams/student/${userId}/attempts`)
      .then(r => r.json())
      .then(data => {
        if (!data.data) return
        const attempts = data.data
        const scores = attempts.map((a: any) => a.total_score)
        const avg = scores.length ? Math.round(scores.reduce((s: number, v: number) => s + v, 0) / scores.length) : 0
        const best = scores.length ? Math.max(...scores) : 0

        // Group by subject
        const subjectMap = new Map<string, { total: number; count: number }>()
        for (const a of attempts) {
          const subj = a.subject_name || "Lainnya"
          const existing = subjectMap.get(subj) || { total: 0, count: 0 }
          subjectMap.set(subj, {
            total: existing.total + a.total_score,
            count: existing.count + 1
          })
        }
        const subjectStats = Array.from(subjectMap.entries()).map(([subject_name, val]) => ({
          subject_name,
          avgScore: Math.round(val.total / val.count),
          count: val.count
        })).sort((a, b) => b.avgScore - a.avgScore)

        setStats({
          totalAttempts: attempts.length,
          avgScore: avg,
          bestScore: Math.round(best),
          subjectStats
        })
      })
      .catch(err => console.error("Gagal load stats:", err))
      .finally(() => setLoading(false))
  }, [user])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-border p-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (!stats || stats.totalAttempts === 0) {
    return (
      <div className="bg-white rounded-2xl border border-border p-10 text-center">
        <Trophy className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
        <p className="font-semibold text-foreground mb-1">Belum ada statistik</p>
        <p className="text-sm text-muted-foreground">
          Selesaikan kuis pertamamu untuk melihat statistik di sini.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<Trophy className="w-5 h-5 text-primary" />} value={stats.totalAttempts} label="Kuis Selesai" />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-amber-600" />} value={stats.avgScore} label="Rata-rata Nilai" />
        <StatCard icon={<Award className="w-5 h-5 text-green-600" />} value={stats.bestScore} label="Nilai Tertinggi" />
      </div>

      {/* Stats per subject */}
      {stats.subjectStats.length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-5">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" /> Performa per Mata Pelajaran
          </h3>
          <div className="space-y-3">
            {stats.subjectStats.map((s) => (
              <div key={s.subject_name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-foreground">{s.subject_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.count} kuis · rata-rata {s.avgScore}
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      s.avgScore >= 80 ? "bg-green-500" :
                      s.avgScore >= 60 ? "bg-yellow-500" : "bg-red-500"
                    }`}
                    style={{ width: `${s.avgScore}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TeacherStatsView() {
  const { user } = useAuth()
  const [stats, setStats] = useState<TeacherStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const userId = user.id

    Promise.all([
      fetch(`${BACKEND_URL}/api/exams/teacher/${userId}`).then(r => r.json()),
      fetch(`${BACKEND_URL}/api/exams/teacher/${userId}/attempts`).then(r => r.json())
    ]).then(([quizzesRes, attemptsRes]) => {
      const quizzes = quizzesRes.data || []
      const attempts = attemptsRes.data || []
      const uniqueStudents = new Set(attempts.map((a: any) => a.student_id)).size
      const avg = attempts.length
        ? Math.round(attempts.reduce((s: number, a: any) => s + a.total_score, 0) / attempts.length)
        : 0

      setStats({
        totalQuizzes: quizzes.length,
        totalAttempts: attempts.length,
        uniqueStudents,
        avgClassScore: avg
      })
    }).catch(err => console.error("Gagal load stats:", err))
      .finally(() => setLoading(false))
  }, [user])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-border p-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={<BookOpen className="w-5 h-5 text-primary" />} value={stats.totalQuizzes} label="Total Kuis Dibuat" />
        <StatCard icon={<UsersIcon className="w-5 h-5 text-blue-600" />} value={stats.uniqueStudents} label="Siswa Unik" />
        <StatCard icon={<Target className="w-5 h-5 text-amber-600" />} value={stats.totalAttempts} label="Total Pengerjaan" />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-green-600" />} value={stats.avgClassScore} label="Rata-rata Kelas" />
      </div>

      {stats.totalAttempts === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Belum ada siswa yang mengerjakan</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Statistik akan terisi setelah siswa mulai mengumpulkan kuis Anda.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-4">
      <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// TAB 4: PENGATURAN (ganti password + logout)
// ═════════════════════════════════════════════════════════════════
function SettingsTab({ onLogout }: { onLogout: () => void }) {
  const { changePassword } = useAuth()
  const router = useRouter()

  const [editingPassword, setEditingPassword] = useState(false)
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  async function handleSavePassword() {
    setMessage(null)
    if (!oldPassword) {
      setMessage({ type: "error", text: "Password lama wajib diisi." })
      return
    }
    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "Password baru minimal 6 karakter." })
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Konfirmasi password tidak cocok." })
      return
    }

    setSaving(true)
    const result = await changePassword(oldPassword, newPassword)
    setSaving(false)

    if (result.success) {
      setMessage({ type: "success", text: result.message })
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setEditingPassword(false)
    } else {
      setMessage({ type: "error", text: result.message })
    }
  }

  function handleCancelPassword() {
    setOldPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setEditingPassword(false)
    setMessage(null)
  }

  function handleLogout() {
    if (window.confirm("Yakin ingin keluar dari akun?")) {
      onLogout()
      router.replace("/login")
    }
  }

  return (
    <div className="space-y-4">
      {/* Ganti Password */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <h3 className="font-bold text-foreground mb-1">Keamanan</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Ubah password untuk menjaga keamanan akunmu.
        </p>

        {message && (
          <div className={`mb-4 p-3 rounded-xl flex items-start gap-2 text-sm ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}>
            {message.type === "success"
              ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            {message.text}
          </div>
        )}

        {editingPassword ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Password Lama
              </label>
              <div className="relative">
                <input
                  type={showOld ? "text" : "password"}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 rounded-xl border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  type="button"
                  onClick={() => setShowOld(!showOld)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Password Baru (min. 6 karakter)
              </label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 rounded-xl border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Konfirmasi Password Baru
              </label>
              <input
                type={showNew ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSavePassword}
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Menyimpan..." : "Ubah Password"}
              </button>
              <button
                onClick={handleCancelPassword}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted"
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-muted/30">
            <div>
              <p className="text-sm font-semibold text-foreground">Password</p>
              <p className="text-xs text-muted-foreground mt-0.5">••••••••</p>
            </div>
            <button
              onClick={() => setEditingPassword(true)}
              className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" /> Ubah
            </button>
          </div>
        )}
      </div>

      {/* Logout */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <h3 className="font-bold text-foreground mb-1">Akun</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Keluar dari akun untuk mengakhiri sesi saat ini.
        </p>
        <button
          onClick={handleLogout}
          className="w-full px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 transition flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Keluar dari Akun
        </button>
      </div>
    </div>
  )
}
