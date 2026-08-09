"use client"

import { useEffect, useRef, useState } from "react"
import { MessageCircle, X, Send, Loader2, Sparkles, AlertCircle } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  isError?: boolean
}

interface Provider {
  id: string
  label: string
  model: string
}

// Riwayat hanya hidup selama tab terbuka. Kalau nanti mau persist,
// tambahkan tabel ChatSession/ChatMessage di Prisma dan simpan di backend.
const MAX_HISTORY_SENT = 12

const STUDENT_SUGGESTIONS = [
  "Tugas apa yang belum aku kerjakan?",
  "Gimana perkembangan nilaiku?",
  "Nilai Matematika aku berapa?",
]

const TEACHER_SUGGESTIONS = [
  "Berapa yang masih perlu saya review?",
  "Kuis mana yang rata-ratanya paling rendah?",
  "Siapa saja siswa saya?",
]

export function ChatbotWidget() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [providers, setProviders] = useState<Provider[]>([])
  const [provider, setProvider] = useState<string>("")

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = user?.role === "teacher" ? TEACHER_SUGGESTIONS : STUDENT_SUGGESTIONS

  // Ambil daftar provider yang API key-nya sudah diisi di backend
  useEffect(() => {
    if (!isOpen || providers.length > 0) return

    let cancelled = false
    async function loadProviders() {
      try {
        const res = await apiFetch("/api/chat/providers")
        if (!res.ok) return
        const json = await res.json()
        if (cancelled) return
        setProviders(json.data?.providers || [])
        setProvider(json.data?.default || "")
      } catch {
        // Gagal ambil daftar provider bukan masalah fatal —
        // backend tetap pakai provider default-nya sendiri.
      }
    }
    loadProviders()
    return () => {
      cancelled = true
    }
  }, [isOpen, providers.length])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, sending])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    const history = messages
      .filter((m) => !m.isError)
      .slice(-MAX_HISTORY_SENT)
      .map((m) => ({ role: m.role, content: m.content }))

    setMessages((prev) => [...prev, { role: "user", content: trimmed }])
    setInput("")
    setSending(true)

    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: trimmed, history, provider: provider || undefined }),
      })
      const json = await res.json()

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: json.message || "Asisten sedang tidak bisa dihubungi.",
            isError: true,
          },
        ])
        return
      }

      setMessages((prev) => [...prev, { role: "assistant", content: json.data.reply }])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Koneksi ke server terputus. Periksa jaringan lalu coba lagi.",
          isError: true,
        },
      ])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  if (!user) return null

  return (
    <>
      {/* Tombol mengambang */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Buka asisten"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground
                     shadow-lg flex items-center justify-center hover:scale-105 transition-transform
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                     focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Panel chat */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Asisten"
          className="fixed z-50 bg-white border border-border shadow-xl flex flex-col
                     inset-x-0 bottom-0 h-[85vh] rounded-t-2xl
                     sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[380px] sm:h-[540px] sm:rounded-2xl"
        >
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-border flex-shrink-0">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground leading-tight">Asisten</p>
              <p className="text-xs text-muted-foreground">
                {user.role === "teacher" ? "Data kuis dan siswa kamu" : "Tugas dan nilai kamu"}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Tutup asisten"
              className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Daftar pesan */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Tanya apa saja soal{" "}
                  {user.role === "teacher" ? "kuis dan siswa kamu" : "tugas dan nilai kamu"}.
                </p>
                <div className="space-y-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full text-left text-sm px-3 py-2 rounded-xl border border-border
                                 hover:border-primary/40 hover:bg-primary/5 transition-colors
                                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : msg.isError
                        ? "bg-red-50 text-red-700 rounded-bl-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  {msg.isError && <AlertCircle className="w-4 h-4 inline mr-1.5 -mt-0.5" />}
                  {msg.content}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground motion-reduce:animate-none" />
                  <span className="text-sm text-muted-foreground">Mencari datanya…</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border flex-shrink-0 space-y-2">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    send(input)
                  }
                }}
                placeholder="Tulis pertanyaan…"
                maxLength={2000}
                disabled={sending}
                className="flex-1 px-3 py-2 rounded-xl border border-border text-sm
                           focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
              <button
                onClick={() => send(input)}
                disabled={sending || !input.trim()}
                aria-label="Kirim pertanyaan"
                className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center
                           justify-center disabled:opacity-40 disabled:cursor-not-allowed
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {providers.length > 1 && (
              <div className="flex items-center gap-2">
                <label htmlFor="chat-provider" className="text-xs text-muted-foreground">
                  Model
                </label>
                <select
                  id="chat-provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="text-xs bg-transparent text-muted-foreground border border-border
                             rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {providers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Belum ada API key yang aktif. Isi salah satu dari GEMINI_API_KEY, OPENAI_API_KEY,
                atau ANTHROPIC_API_KEY di file .env backend.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
