"use client"

import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

export interface CaptchaFieldHandle {
  reload: () => void
  resolveAnswer: () => Promise<{ ok: boolean; answer?: CaptchaAnswer; message?: string }>
}

export type CaptchaAnswer = string | number[]

interface CaptchaFieldProps {
  onTokenChange: (token: string) => void
  value: CaptchaAnswer
  onValueChange: (value: CaptchaAnswer) => void
  onEnabledChange?: (enabled: boolean) => void
  disabled?: boolean
}

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void
      execute: (siteKey: string, opts: { action: string }) => Promise<string>
      render: (container: HTMLElement, opts: {
        sitekey: string
        callback: (token: string) => void
        "expired-callback"?: () => void
        "error-callback"?: () => void
      }) => number
      reset: (widgetId?: number) => void
    }
  }
}

/**
 * Memuat script reCAPTCHA sekali saja.
 * v2 memakai render=explicit (widget dirender manual dari kode);
 * v3 perlu parameter render=<site key>.
 */
function loadRecaptchaScript(siteKey: string, version: "v2" | "v3"): Promise<void> {
  const id = "recaptcha-script"
  if (document.getElementById(id)) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.id = id
    script.src = version === "v3"
      ? `https://www.google.com/recaptcha/api.js?render=${siteKey}`
      : "https://www.google.com/recaptcha/api.js?render=explicit"
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("script gagal dimuat"))
    document.head.appendChild(script)
  })
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 11-3.5-7.1" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}

/** idle → memilih → memeriksa → lulus */
type Phase = "idle" | "loading" | "challenge" | "verifying" | "passed"

export const CaptchaField = forwardRef<CaptchaFieldHandle, CaptchaFieldProps>(function CaptchaField(
  { onTokenChange, value, onValueChange, onEnabledChange, disabled },
  ref
) {
  const [mode, setMode] = useState<"text" | "image" | "recaptcha">("text")
  const [phase, setPhase] = useState<Phase>("idle")
  const [image, setImage] = useState("")
  const [prompt, setPrompt] = useState("")
  const [tiles, setTiles] = useState<string[]>([])
  const [challengeToken, setChallengeToken] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [failed, setFailed] = useState(false)
  const [notice, setNotice] = useState("")

  const siteKeyRef = useRef("")
  const scriptReady = useRef(false)

  // ── Khusus reCAPTCHA ──
  const [recaptchaVersion, setRecaptchaVersion] = useState<"v2" | "v3">("v2")
  const [v2Token, setV2Token] = useState("")
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const v2ContainerRef = useRef<HTMLDivElement>(null)
  const v2WidgetId = useRef<number | null>(null)

  /** Ambil soal dari server. Untuk mode gambar dipanggil saat checkbox diklik. */
  const fetchChallenge = useCallback(async (showPanel: boolean) => {
    setFailed(false)
    if (showPanel) setPhase("loading")

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/captcha`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "gagal")

      if (data.enabled === false) {
        setEnabled(false)
        onEnabledChange?.(false)
        onTokenChange("")
        return
      }

      setEnabled(true)
      onEnabledChange?.(true)

      if (data.mode === "recaptcha") {
        const version = data.version === "v3" ? "v3" : "v2"
        setMode("recaptcha")
        setRecaptchaVersion(version)
        siteKeyRef.current = data.site_key
        onTokenChange(data.token)
        onValueChange("")
        setV2Token("")
        try {
          await loadRecaptchaScript(data.site_key, version)
          scriptReady.current = true
          setScriptLoaded(true)      // memicu effect yang merender widget v2
        } catch {
          scriptReady.current = false
          setFailed(true)
        }
        return
      }

      if (data.mode === "image") {
        setMode("image")
        setPrompt(data.prompt || "")
        setTiles(data.images || [])
        setChallengeToken(data.token)
        onValueChange([])
        if (showPanel) setPhase("challenge")
        return
      }

      // Mode teks tampil apa adanya, tanpa checkbox
      setMode("text")
      setImage(data.image || "")
      onTokenChange(data.token)
      onValueChange("")
    } catch {
      setFailed(true)
      onTokenChange("")
      if (showPanel) setPhase("idle")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Saat halaman dibuka, cukup tanyakan mode-nya. Untuk mode gambar,
  // soalnya baru diambil ketika user mencentang kotak.
  useEffect(() => { fetchChallenge(false) }, [fetchChallenge])

  // Render widget v2 setelah script siap dan container-nya ada di DOM.
  // grecaptcha.render kadang belum tersedia tepat setelah onload,
  // jadi ditunggu dengan polling singkat.
  useEffect(() => {
    if (mode !== "recaptcha" || recaptchaVersion !== "v2") return
    if (!scriptLoaded) return
    if (v2WidgetId.current !== null) return

    const timer = setInterval(() => {
      if (!window.grecaptcha?.render || !v2ContainerRef.current) return
      clearInterval(timer)
      try {
        v2WidgetId.current = window.grecaptcha.render(v2ContainerRef.current, {
          sitekey: siteKeyRef.current,
          callback: (token: string) => { setV2Token(token); onValueChange(token) },
          "expired-callback": () => { setV2Token(""); onValueChange("") },
          "error-callback": () => { setV2Token(""); onValueChange(""); setFailed(true) }
        })
      } catch {
        setFailed(true)
      }
    }, 100)

    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, recaptchaVersion, scriptLoaded])

  const reset = useCallback(() => {
    setPhase("idle")
    setNotice("")
    onTokenChange("")
    onValueChange(mode === "image" ? [] : "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const startChallenge = useCallback(() => {
    setNotice("")
    fetchChallenge(true)
  }, [fetchChallenge])

  /** Kirim pilihan gambar ke server; kalau benar dapat tiket lulus. */
  const submitChallenge = useCallback(async () => {
    const selected = Array.isArray(value) ? value : []
    if (selected.length === 0) {
      setNotice("Pilih dulu gambarnya.")
      return
    }

    setPhase("verifying")
    setNotice("")

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/captcha/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: challengeToken, answer: selected })
      })
      const data = await res.json()

      if (!res.ok) {
        setNotice(data?.message || "Pilihannya belum tepat. Coba lagi.")
        await fetchChallenge(true)      // soal lama hangus, ambil yang baru
        return
      }

      onTokenChange(data.pass_token)
      onValueChange("ok")
      setPhase("passed")
    } catch {
      setNotice("Tidak dapat menghubungi server. Coba lagi.")
      setPhase("challenge")
    }
  }, [value, challengeToken, fetchChallenge, onTokenChange, onValueChange])

  const resolveAnswer = useCallback(async () => {
    if (mode === "image") {
      if (phase !== "passed") {
        return { ok: false, message: "Centang dulu kotak \"Saya bukan robot\"." }
      }
      return { ok: true, answer: "ok" as CaptchaAnswer }
    }

    if (mode === "text") {
      const text = typeof value === "string" ? value.trim() : ""
      if (!text) return { ok: false, message: "Isi dulu kode keamanannya." }
      return { ok: true, answer: value }
    }

    // ── reCAPTCHA ──
    if (!scriptReady.current || !window.grecaptcha) {
      return { ok: false, message: "Verifikasi keamanan belum siap. Periksa koneksi internetmu." }
    }

    // v2: token sudah didapat saat user mencentang kotak
    if (recaptchaVersion === "v2") {
      if (!v2Token) {
        return { ok: false, message: "Centang dulu kotak \"Saya bukan robot\"." }
      }
      return { ok: true, answer: v2Token }
    }

    // v3: token hanya berlaku 2 menit, jadi diambil di detik terakhir
    try {
      const token = await new Promise<string>((resolve, reject) => {
        window.grecaptcha!.ready(() => {
          window.grecaptcha!
            .execute(siteKeyRef.current, { action: "login" })
            .then(resolve)
            .catch(reject)
        })
      })
      return { ok: true, answer: token }
    } catch {
      return { ok: false, message: "Verifikasi keamanan gagal dijalankan. Coba lagi." }
    }
  }, [mode, phase, value, recaptchaVersion, v2Token])

  useImperativeHandle(ref, () => ({
    reload: () => {
      // Widget v2 punya cara reset sendiri; tidak perlu ambil soal baru ke server.
      if (mode === "recaptcha" && recaptchaVersion === "v2" && v2WidgetId.current !== null) {
        try { window.grecaptcha?.reset(v2WidgetId.current) } catch { /* abaikan */ }
        setV2Token("")
        onValueChange("")
        return
      }
      reset()
      if (mode !== "image") fetchChallenge(false)
    },
    resolveAnswer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [reset, resolveAnswer, fetchChallenge, mode, recaptchaVersion])

  if (!enabled) return null

  /* ── Mode reCAPTCHA ── */
  if (mode === "recaptcha") {
    if (recaptchaVersion === "v2") {
      return (
        <div className="login-captcha login-captcha--v2">
          <div ref={v2ContainerRef} className="login-captcha-v2-widget" />
          {failed && (
            <p className="login-captcha-hint login-captcha-hint--error">
              Verifikasi keamanan gagal dimuat. Periksa koneksi internet, lalu muat ulang halaman.
            </p>
          )}
        </div>
      )
    }

    return (
      <div className="login-captcha">
        {failed ? (
          <p className="login-captcha-hint login-captcha-hint--error">
            Verifikasi keamanan gagal dimuat. Periksa koneksi internet, lalu muat ulang halaman.
          </p>
        ) : (
          <p className="login-captcha-hint">
            Dilindungi reCAPTCHA. Berlaku{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Kebijakan Privasi</a>
            {" "}dan{" "}
            <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Persyaratan Layanan</a>
            {" "}Google.
          </p>
        )}
      </div>
    )
  }

  /* ── Mode teks: kotak isian biasa ── */
  if (mode === "text") {
    return (
      <div className="login-captcha">
        <div className="login-captcha-row">
          <div className="login-captcha-image">
            {failed ? (
              <span className="login-captcha-placeholder">Kode gagal dimuat</span>
            ) : image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="Kode keamanan berupa lima huruf dan angka" />
            ) : (
              <span className="login-captcha-placeholder">Memuat kode...</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => fetchChallenge(false)}
            disabled={disabled}
            className="login-captcha-refresh"
            title="Ganti kode"
            aria-label="Ganti kode keamanan"
          >
            <RefreshIcon />
          </button>
        </div>

        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder="Ketik kode di atas"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={8}
          disabled={disabled}
          className="login-input login-captcha-input"
        />
      </div>
    )
  }

  /* ── Mode gambar: checkbox dulu, grid menyusul ── */
  const selected: number[] = Array.isArray(value) ? value : []

  const toggleTile = (idx: number) => {
    if (disabled) return
    onValueChange(selected.includes(idx) ? selected.filter((i) => i !== idx) : [...selected, idx])
  }

  return (
    <div className="login-captcha">
      {/* Baris checkbox — selalu tampil */}
      <div className="login-captcha-checkbox-row">
        <button
          type="button"
          onClick={phase === "passed" ? reset : startChallenge}
          disabled={disabled || phase === "loading" || phase === "verifying"}
          className={`login-captcha-box${phase === "passed" ? " login-captcha-box--on" : ""}`}
          aria-pressed={phase === "passed"}
          aria-label="Saya bukan robot"
        >
          {phase === "loading" || phase === "verifying" ? (
            <span className="login-captcha-spinner" />
          ) : phase === "passed" ? (
            <CheckIcon size={16} />
          ) : null}
        </button>

        <span className="login-captcha-label">
          {phase === "passed" ? "Terverifikasi" : "Saya bukan robot"}
        </span>

        <span className="login-captcha-brand" aria-hidden="true"><ShieldIcon /></span>
      </div>

      {notice && <p className="login-captcha-hint login-captcha-hint--error">{notice}</p>}
      {failed && phase === "idle" && (
        <p className="login-captcha-hint login-captcha-hint--error">
          Soal gagal dimuat. Coba lagi sebentar.
        </p>
      )}

      {/* Panel soal — hanya saat sedang mengerjakan */}
      {(phase === "loading" || phase === "challenge" || phase === "verifying") && (
        <div className="login-captcha-panel">
          <p className="login-captcha-prompt">
            Pilih semua gambar <strong>{prompt || "..."}</strong>
          </p>

          <div className="login-captcha-grid" role="group" aria-label={`Pilih semua gambar ${prompt}`}>
            {phase === "loading" || tiles.length === 0
              ? Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="login-captcha-tile login-captcha-tile--skeleton" />
                ))
              : tiles.map((tileId, idx) => {
                  const isOn = selected.includes(idx)
                  return (
                    <button
                      key={tileId}
                      type="button"
                      onClick={() => toggleTile(idx)}
                      disabled={disabled || phase === "verifying"}
                      aria-pressed={isOn}
                      aria-label={`Gambar ${idx + 1}`}
                      className={`login-captcha-tile${isOn ? " login-captcha-tile--on" : ""}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${BACKEND_URL}/api/auth/captcha/image/${tileId}`} alt="" />
                      {isOn && <span className="login-captcha-check"><CheckIcon /></span>}
                    </button>
                  )
                })}
          </div>

          <div className="login-captcha-panel-footer">
            <button
              type="button"
              onClick={() => fetchChallenge(true)}
              disabled={phase !== "challenge"}
              className="login-captcha-refresh"
              title="Ganti soal"
              aria-label="Ganti soal keamanan"
            >
              <RefreshIcon />
            </button>

            <button
              type="button"
              onClick={submitChallenge}
              disabled={phase !== "challenge"}
              className="login-captcha-verify"
            >
              {phase === "verifying" ? "Memeriksa..." : "Verifikasi"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
})

export default CaptchaField