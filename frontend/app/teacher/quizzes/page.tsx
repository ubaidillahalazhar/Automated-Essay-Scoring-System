"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/shared/sidebar"
import { PlusSquare, FileText, Clock, Users, Trash2 } from "lucide-react"

// 1. Buat tipe data (Interface) yang cocok dengan struktur Prisma Database
interface QuizDB {
  quiz_id: number;
  title: string;
  description: string | null;
  time_limit: number;
  due_date: string;
  subject: { subject_id: number; subject_name: string };
  grade:   { grade_id: number; grade_name: string };
  _count: { questions: number };
}

export default function TeacherQuizzes() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  
  // Gunakan state tipe baru
  const [quizzes, setQuizzes] = useState<QuizDB[]>([])
  const [isFetching, setIsFetching] = useState(true)

  // Autentikasi
  useEffect(() => {
    if (!isLoading && (!user || user.role !== "teacher")) router.replace("/login")
  }, [user, isLoading, router])

  // 2. Fetch data dari Backend Express
  useEffect(() => {
    if (!user) return;

    const fetchTeacherQuizzes = async () => {
      try {
        const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        // Memanggil API dengan ID guru yang sedang login
        const response = await fetch(`${BACKEND_URL}/api/exams/teacher/${user.id}`);

        const result = await response.json();

        if (response.ok) {
          setQuizzes(result.data);
        } else {
          console.error("Gagal menarik data:", result.message);
        }
      } catch (error) {
        console.error("Error koneksi ke backend:", error);
      } finally {
        setIsFetching(false);
      }
    };

    fetchTeacherQuizzes();
  }, [user]);

  // Fungsi Hapus (Hanya Mockup Sementara, karena kita belum buat API Delete-nya)
  function deleteQuiz(quizId: number) {
    alert(`Fitur hapus untuk Kuis ID ${quizId} akan segera dihubungkan ke database!`);
  }

  if (isLoading || !user) return null

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:p-8 p-4 pt-16 lg:pt-8 overflow-y-auto">
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Kuis Saya</h1>
            <p className="text-muted-foreground">Kelola semua kuis yang telah kamu buat.</p>
          </div>
          <Link href="/teacher/create-quiz" className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors flex-shrink-0">
            <PlusSquare className="w-4 h-4" /> Buat Kuis
          </Link>
        </div>

        {isFetching ? (
          <div className="text-center p-12 text-muted-foreground">Memuat kuis dari database...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {quizzes.length === 0 ? (
              <div className="col-span-full bg-white rounded-2xl border border-border p-12 text-center">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-7 h-7 text-primary" />
                </div>
                <p className="font-semibold text-foreground mb-1">Belum ada kuis</p>
                <p className="text-sm text-muted-foreground mb-4">Mulai buat kuis pertamamu.</p>
                <Link href="/teacher/create-quiz" className="inline-block px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors">
                  Buat Kuis Sekarang
                </Link>
              </div>
            ) : (
              quizzes.map((quiz) => (
                <div key={quiz.quiz_id} className="bg-white rounded-2xl border border-border p-5 flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-foreground leading-tight">{quiz.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{quiz.subject?.subject_name} • {quiz.grade?.grade_name}</p>
                    </div>
                  </div>

                  {quiz.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{quiz.description}</p>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {quiz.time_limit} menit</span>
                    <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {quiz._count.questions} soal</span>
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> 0 pengumpulan</span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Tenggat: {new Date(quiz.due_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </div>

                  <div className="flex justify-end pt-1 border-t border-border mt-2">
                    <button
                      onClick={() => deleteQuiz(quiz.quiz_id)}
                      className="flex items-center gap-1.5 text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  )
}