"use client"

export type UserRole = "student" | "teacher"

export interface User {
  id: string | number   // ← bisa string (mock) atau number (dari backend)
  name: string
  email: string
  role: "teacher" | "student"
  avatar?: string
  class?: string
  subject?: string
  // ─── Field BARU untuk integrasi backend ───
  grade_id?: number | null
  grade_name?: string | null
  school_level?: string | null
  teaching_level?: string | null
}

export interface Question {
  id: string
  text: string
  type: "essay" | "multiple_choice"
  options?: string[]
  correctAnswer: string
  points: number
}

export interface Quiz {
  id: string
  title: string
  subject: string
  teacherId: string
  teacherName: string
  description: string
  timeLimit: number
  questions: Question[]
  createdAt: string
  dueDate: string
  isActive: boolean
  class: string
}

export interface Assignment {
  id: string
  quizId: string
  quizTitle: string
  subject: string
  teacherName: string
  dueDate: string
  status: "pending" | "completed" | "overdue"
  score?: number
  maxScore: number
  class: string
}

export interface StudentAnswer {
  questionId: string
  answer: string
  score?: number
  feedback?: string
  isCorrect?: boolean
}

export interface QuizAttempt {
  id: string
  quizId: string
  quizTitle: string
  studentId: string | number
  studentName: string
  studentClass: string
  answers: StudentAnswer[]
  totalScore: number
  maxScore: number
  completedAt: string
  timeTaken: number
  aiAnalysis?: string
}

// ─────────────────────────────────────────────────────────
// MOCK DATA (untuk fallback / development)
// ─────────────────────────────────────────────────────────
export const MOCK_USERS: User[] = []
export const MOCK_QUIZZES: Quiz[] = []
export const MOCK_ATTEMPTS: QuizAttempt[] = []

// ─────────────────────────────────────────────────────────
// localStorage helpers
// ─────────────────────────────────────────────────────────
export const AUTH_KEY = "eduquiz_user"
export const QUIZZES_KEY = "eduquiz_quizzes"
export const ATTEMPTS_KEY = "eduquiz_attempts"

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(AUTH_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function setStoredUser(user: User | null) {
  if (typeof window === "undefined") return
  if (user) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(AUTH_KEY)
  }
}

export function getStoredQuizzes(): Quiz[] {
  if (typeof window === "undefined") return MOCK_QUIZZES
  try {
    const stored = localStorage.getItem(QUIZZES_KEY)
    return stored ? JSON.parse(stored) : MOCK_QUIZZES
  } catch {
    return MOCK_QUIZZES
  }
}

export function saveQuizzes(quizzes: Quiz[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(QUIZZES_KEY, JSON.stringify(quizzes))
}

export function getStoredAttempts(): QuizAttempt[] {
  if (typeof window === "undefined") return MOCK_ATTEMPTS
  try {
    const stored = localStorage.getItem(ATTEMPTS_KEY)
    return stored ? JSON.parse(stored) : MOCK_ATTEMPTS
  } catch {
    return MOCK_ATTEMPTS
  }
}

export function saveAttempts(attempts: QuizAttempt[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts))
}