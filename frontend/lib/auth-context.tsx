"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import Cookies from "js-cookie";
import { type User, getStoredUser, setStoredUser } from "./store"

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>
  signup: (
    name: string,
    email: string,
    password: string,
    role: "student" | "teacher",
    extra?: string,
    grade_id?: number
  ) => Promise<{ success: boolean; message: string }>
  updateProfile: (grade_id: number) => Promise<{ success: boolean; message: string }>   // ← BARU
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = getStoredUser()
    setUser(stored)
    setIsLoading(false)
  }, [])

  async function login(email: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, message: data.message || "Login gagal." };
      }

      if (data.token) {
        localStorage.setItem("token", data.token);
        Cookies.set("token", data.token, { expires: 1 });
      }

      const loggedInUser = data.user;
      setUser(loggedInUser);
      setStoredUser(loggedInUser);

      return { success: true, message: "Berhasil masuk!" };
    } catch (error) {
      return { success: false, message: "Terjadi kesalahan pada server backend." };
    }
  }

  async function signup(
    name: string,
    email: string,
    password: string,
    role: "student" | "teacher",
    extra?: string,
    grade_id?: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      const body: any = {
        name, email, password, role,
      };
      // KIRIM grade_id LANGSUNG ke backend (sudah ada di skema PendingUser setelah migration)
      if (role === "student" && grade_id) {
        body.grade_id = grade_id;
      }

      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, message: data.message || "Gagal mendaftar." };
      }

      return { success: true, message: "Akun berhasil dibuat!" };
    } catch (error) {
      return { success: false, message: "Terjadi kesalahan pada server backend." };
    }
  }

  /**
   * Update profil (untuk siswa yang grade_id-nya null karena bug lama).
   * Setelah update, user state di-refresh otomatis.
   */
  async function updateProfile(grade_id: number): Promise<{ success: boolean; message: string }> {
    if (!user) return { success: false, message: "Belum login." };

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/profile/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade_id })
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, message: data.message || "Gagal memperbarui profil." };
      }

      // Update user state
      setUser(data.user);
      setStoredUser(data.user);

      return { success: true, message: "Profil berhasil diperbarui!" };
    } catch (error) {
      return { success: false, message: "Terjadi kesalahan pada server backend." };
    }
  }

  function logout() {
    setUser(null);
    setStoredUser(null);
    localStorage.removeItem("token");
    Cookies.remove("token");
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, updateProfile, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
