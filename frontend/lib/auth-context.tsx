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
    grade_id?: number    // ← BARU: untuk siswa
  ) => Promise<{ success: boolean; message: string }>
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
        return { success: false, message: data.message || "Login gagal. Periksa email dan kata sandi." };
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
    grade_id?: number    // ← BARU
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          school: role === "student" ? extra : undefined,
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, message: data.message || "Gagal mendaftar." };
      }

      // Simpan grade_id sementara di localStorage supaya halaman verify-otp
      // bisa kirim ulang ke backend (PendingUser tidak menyimpan grade_id).
      if (role === "student" && grade_id) {
        localStorage.setItem("pending_grade_id", String(grade_id));
        localStorage.setItem("pending_email", email);
      }

      return { success: true, message: "Akun berhasil dibuat!" };
    } catch (error) {
      return { success: false, message: "Terjadi kesalahan pada server backend." };
    }
  }

  function logout() {
    setUser(null)
    setStoredUser(null)
    localStorage.removeItem("token")
    Cookies.remove("token")
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
