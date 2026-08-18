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

const BUTTON_SIZE = 56 // px — cocok dengan w-14 h-14
const PANEL_WIDTH = 380
const PANEL_HEIGHT = 540
const PANEL_MARGIN = 16
// Kiri, sedikit di atas tombol "Keluar" di footer sidebar desktop.
// Posisi ini SENGAJA tidak disimpan lintas sesi — tiap kali dashboard dibuka,
// bubble selalu mulai dari sini lagi, walau sempat digeser sebelumnya.
const DEFAULT_POS = { left: 20, bottom: 120 }
const DRAG_THRESHOLD = 6 // px pointer harus bergerak dulu sebelum dianggap drag, bukan klik

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function clampToViewport(p: { left: number; bottom: number }) {
  if (typeof window === "undefined") return p
  const maxLeft = Math.max(0, window.innerWidth - BUTTON_SIZE)
  const maxBottom = Math.max(0, window.innerHeight - BUTTON_SIZE)
  return { left: clamp(p.left, 0, maxLeft), bottom: clamp(p.bottom, 0, maxBottom) }
}

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

  // Posisi bubble (bisa digeser). Disimpan sebagai jarak dari kiri & bawah viewport.
  const [pos, setPos] = useState(DEFAULT_POS)
  const posRef = useRef(DEFAULT_POS)
  const draggingRef = useRef(false)
  const draggedRef = useRef(false)
  const dragStartRef = useRef({ pointerX: 0, pointerY: 0, left: 0, bottom: 0 })

  function updatePos(next: { left: number; bottom: number }) {
    posRef.current = next
    setPos(next)
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    draggingRef.current = true
    draggedRef.current = false
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      left: posRef.current.left,
      bottom: posRef.current.bottom,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current) return
    const dx = e.clientX - dragStartRef.current.pointerX
    const dy = e.clientY - dragStartRef.current.pointerY
    if (!draggedRef.current && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      draggedRef.current = true
    }
    if (!draggedRef.current) return
    updatePos(
      clampToViewport({
        left: dragStartRef.current.left + dx,
        bottom: dragStartRef.current.bottom - dy,
      })
    )
  }

  function handlePointerUp() {
    draggingRef.current = false
  }

  function handleButtonClick() {
    // Kalau baru saja selesai drag, jangan buka panel — itu bukan klik sungguhan.
    if (draggedRef.current) {
      draggedRef.current = false
      return
    }
    setIsOpen(true)
  }

  // Panel dibuka menempel di posisi bubble saat ini, tapi tetap dijaga jangan sampai keluar layar.
  const panelAnchor =
    typeof window === "undefined"
      ? pos
      : {
          left: clamp(pos.left, PANEL_MARGIN, Math.max(PANEL_MARGIN, window.innerWidth - PANEL_WIDTH - PANEL_MARGIN)),
          bottom: clamp(pos.bottom, PANEL_MARGIN, Math.max(PANEL_MARGIN, window.innerHeight - PANEL_HEIGHT - PANEL_MARGIN)),
        }

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
      {/* Tombol mengambang — bisa digeser ke posisi mana saja */}
      {!isOpen && (
        <button
          onClick={handleButtonClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ left: pos.left, bottom: pos.bottom, touchAction: "none" }}
          aria-label="Buka asisten (bisa digeser)"
          className="fixed z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground
                     shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing
                     hover:scale-105 transition-transform
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
          style={{
            ["--chat-left" as string]: `${panelAnchor.left}px`,
            ["--chat-bottom" as string]: `${panelAnchor.bottom}px`,
          }}
          className="fixed z-50 bg-white border border-border shadow-xl flex flex-col
                     inset-x-0 bottom-0 h-[85vh] rounded-t-2xl
                     sm:inset-auto sm:bottom-[var(--chat-bottom)] sm:left-[var(--chat-left)]
                     sm:w-[380px] sm:h-[540px] sm:rounded-2xl"
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
