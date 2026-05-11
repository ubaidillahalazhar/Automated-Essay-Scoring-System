"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  BookOpen, LayoutDashboard, FileText, ClipboardList,
  BarChart2, LogOut, Menu, X, PlusSquare, Users
} from "lucide-react"
import { useState } from "react"

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const studentNav: NavItem[] = [
  { label: "Dashboard", href: "/student/dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: "Tugas Saya", href: "/student/assignments", icon: <ClipboardList className="w-4 h-4" /> },
  { label: "Nilai Saya", href: "/student/results", icon: <BarChart2 className="w-4 h-4" /> },
]

const teacherNav: NavItem[] = [
  { label: "Dashboard", href: "/teacher/dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: "Buat Kuis", href: "/teacher/create-quiz", icon: <PlusSquare className="w-4 h-4" /> },
  { label: "Kuis Saya", href: "/teacher/quizzes", icon: <FileText className="w-4 h-4" /> },
  { label: "Nilai Siswa", href: "/teacher/scores", icon: <Users className="w-4 h-4" /> },
  { label: "Analisis AI", href: "/teacher/analysis", icon: <BarChart2 className="w-4 h-4" /> },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (!user) return null

  const nav = user.role === "student" ? studentNav : teacherNav

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-primary">EduQuiz</span>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
            {user.avatar || user.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user.role === "student" ? `Siswa • ${user.class}` : `Guru • ${user.subject}`}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-border">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all w-full"
        >
          <LogOut className="w-4 h-4" />
          Keluar
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 bg-white border-r border-border h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-primary">EduQuiz</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-lg hover:bg-muted transition-colors">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}
