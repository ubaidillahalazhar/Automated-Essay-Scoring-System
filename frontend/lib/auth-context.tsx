"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import Cookies from "js-cookie";
import { type User, getStoredUser, setStoredUser } from "./store"

interface UpdateProfilePayload {
  name?: string
  grade_id?: number
}

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
  updateProfile: (payload: UpdateProfilePayload) => Promise<{ success: boolean; message: string }>
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>
  refreshProfile: () => Promise<void>
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
      const body: any = { name, email, password, role };
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

      if (role === "student" && grade_id) {
        localStorage.setItem("pending_grade_id", String(grade_id));
        localStorage.setItem("pending_email", email);
      }

      return { success: true, message: "Akun berhasil dibuat!" };
    } catch (error) {
      return { success: false, message: "Terjadi kesalahan pada server backend." };
    }
  }

  /**
   * Update profil. Bisa update name, grade_id, atau keduanya.
   * Server hanya update field yang dikirim (PATCH-like).
   */
  async function updateProfile(payload: UpdateProfilePayload): Promise<{ success: boolean; message: string }> {
    if (!user) return { success: false, message: "Belum login." };

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/profile/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, message: data.message || "Gagal memperbarui profil." };
      }

      setUser(data.user);
      setStoredUser(data.user);

      return { success: true, message: data.message || "Profil berhasil diperbarui!" };
    } catch (error) {
      return { success: false, message: "Terjadi kesalahan pada server backend." };
    }
  }

  /**
   * Ganti password. Backend akan verifikasi password lama dulu.
   */
  async function changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    if (!user) return { success: false, message: "Belum login." };

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/password/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, message: data.message || "Gagal mengubah password." };
      }

      return { success: true, message: "Password berhasil diubah!" };
    } catch (error) {
      return { success: false, message: "Terjadi kesalahan pada server backend." };
    }
  }

  /**
   * Re-fetch user profile dari backend (mis. setelah update di tempat lain).
   */
  async function refreshProfile() {
    if (!user) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/profile/${user.id}`);
      const data = await response.json();
      if (response.ok && data.user) {
        setUser(data.user);
        setStoredUser(data.user);
      }
    } catch (error) {
      console.error("Gagal refresh profile:", error);
    }
  }

  function logout() {
    setUser(null);
    setStoredUser(null);
    localStorage.removeItem("token");
    Cookies.remove("token");
  }

  return (
    <AuthContext.Provider value={{
      user, login, signup, updateProfile, changePassword,
      refreshProfile, logout, isLoading
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
