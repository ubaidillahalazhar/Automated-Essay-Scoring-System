"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import Cookies from "js-cookie";
import { type User, getStoredUser, setStoredUser } from "./store"

// 1. Ubah tipe balikan menjadi Promise karena sekarang kita melakukan pemanggilan API yang butuh waktu (asynchronous)
interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>
  signup: (name: string, email: string, password: string, role: "student" | "teacher", extra?: string) => Promise<{ success: boolean; message: string }>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = getStoredUser()
    setUser(stored)
    setIsLoading(false)
  }, [])

  // 2. Logika Login Asli ke Backend
  async function login(email: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
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
  // Simpan di Cookie agar Middleware bisa membaca tiket ini
  Cookies.set("token", data.token, { expires: 1 }); // Habis dalam 1 hari
}

      // Ambil data user dari respons backend (sesuaikan 'data.user' dengan format backend Anda)
      const loggedInUser = data.user; 
      
      setUser(loggedInUser);
      setStoredUser(loggedInUser); // Memperbarui session di seluruh aplikasi
      
      return { success: true, message: "Berhasil masuk!" };
    } catch (error) {
      return { success: false, message: "Terjadi kesalahan pada server backend." };
    }
  }

  // 3. Logika Signup Asli ke Backend
  async function signup(
    name: string,
    email: string,
    password: string,
    role: "student" | "teacher",
    extra?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name, // Di parameter menggunakan 'name', kita kirim ke backend sebagai 'username'
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

      // Setelah mendaftar, biasanya tidak langsung login (butuh verifikasi OTP atau harus login manual)
      return { success: true, message: "Akun berhasil dibuat!" };
    } catch (error) {
      return { success: false, message: "Terjadi kesalahan pada server backend." };
    }
  }

  function logout() {
  setUser(null);
  setStoredUser(null);
  localStorage.removeItem("token");
  Cookies.remove("token"); // Hapus juga cookienya
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