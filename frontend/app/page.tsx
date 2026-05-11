"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

export default function RootPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace("/login")
    } else if (user.role === "student") {
      router.replace("/student/dashboard")
    } else {
      router.replace("/teacher/dashboard")
    }
  }, [user, isLoading, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-muted-foreground font-medium">Memuat...</p>
      </div>
    </div>
  )
}
