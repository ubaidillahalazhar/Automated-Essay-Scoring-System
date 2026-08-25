
import logging
import os
import re
import time
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from llama_cpp import Llama

load_dotenv()   

MODEL_PATH   = os.getenv("MODEL_PATH", "D:/Automated-Essay-Scoring-System/ai-service/models/qwen3-grader-q4km.gguf")
N_CTX        = int(os.getenv("N_CTX", "2048"))
N_GPU_LAYERS = int(os.getenv("N_GPU_LAYERS", "0"))
N_THREADS    = int(os.getenv("N_THREADS", "0"))
USE_MLOCK    = os.getenv("USE_MLOCK", "true").lower() in ("1", "true", "yes")
HOST         = os.getenv("HOST", "0.0.0.0")
PORT         = int(os.getenv("PORT", "8000"))

THRESHOLD  = float(os.getenv("THRESHOLD", "0.55"))
MODEL_MODE = os.getenv("MODEL_MODE", "skor+alasan")      # "skor" | "skor+alasan"

ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:5000"]


# ══════════════════════════════════════════════════════════════
# PROMPT — SAMA PERSIS DENGAN NOTEBOOK BAGIAN 5
# ══════════════════════════════════════════════════════════════
_PANDUAN = """Panduan skor:
  1.0       : lengkap dan tepat, semua poin kunci tercakup
  0.7 - 0.9 : sebagian besar poin penting tercakup
  0.4 - 0.6 : sebagian benar atau kurang lengkap
  0.1 - 0.3 : hampir tidak relevan
  0.0       : tidak relevan, kosong, atau "tidak tahu"

Fokus pada kemiripan makna, bukan kesamaan kata. Sinonim dianggap benar."""

if MODEL_MODE == "skor":
    SYSTEM_PROMPT = (
        "Kamu adalah penilai jawaban esai siswa. Beri skor kemiripan makna antara "
        "Jawaban Siswa dan Kunci Jawaban dalam skala 0.0 sampai 1.0.\n\n"
        + _PANDUAN + "\n\nJawab hanya satu baris:\nSkor: <angka>"
    )
else:
    SYSTEM_PROMPT = (
        "Kamu adalah penilai jawaban esai siswa. Analisis jawaban siswa terhadap "
        "kunci jawaban, lalu beri skor 0.0 sampai 1.0.\n\n"
        + _PANDUAN + "\n\nJawab dalam format:\n"
        "Analisis: <umpan balik 2-3 kalimat yang menyebut isi jawaban siswa>\n"
        "Skor: <angka>"
    )


logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(levelname)s - %(message)s",
                    datefmt="%H:%M:%S")
log = logging.getLogger("grader-api")

state = {"llm": None, "ready": False}


# ══════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════
def _detect_cpu_threads() -> int:
    try:
        import psutil
        cores = psutil.cpu_count(logical=False)
        if cores:
            return cores
    except ImportError:
        pass
    return max(1, (os.cpu_count() or 4) // 2)


def _build_user_message(soal: str, kunci: str, jawaban: str) -> str:
    """IDENTIK dengan buat_user_prompt() di notebook."""
    return (f"Soal: {soal.strip()}\n\n"
            f"Kunci Jawaban: {kunci.strip()}\n\n"
            f"Jawaban Siswa: {jawaban.strip()}")


def _bersihkan(t: str) -> str:
    t = re.sub(r"<think>.*?</think>", "", t or "", flags=re.DOTALL)
    t = re.sub(r"<\|[^|]*\|>", "", t)
    return t.strip()


_RE_SKOR   = re.compile(r"Skor\s*:\s*([01](?:[.,]\d+)?)", re.IGNORECASE)
_RE_ANGKA  = re.compile(r"\b([01](?:[.,]\d+)?)\b")
_RE_ALASAN = re.compile(r"Analisis\s*:\s*(.+?)(?:\n\s*Skor|$)", re.S | re.I)


def _parse_skor(teks: str, izinkan_longgar: bool = True) -> Optional[float]:
    """izinkan_longgar=False dipakai di mode skor+alasan, supaya angka di dalam
    teks analisis tidak salah terbaca sebagai skor."""
    m = _RE_SKOR.search(teks)
    if m:
        return max(0.0, min(1.0, float(m.group(1).replace(",", "."))))
    if not izinkan_longgar:
        return None
    m2 = _RE_ANGKA.search(teks)
    if not m2:
        return None
    return max(0.0, min(1.0, float(m2.group(1).replace(",", "."))))


def _alasan_cadangan(skor: float) -> str:
    """Dipakai hanya kalau model tidak menghasilkan analisis.
    CATATAN: ini template berbasis skor, bukan diagnosis isi jawaban."""
    if skor >= 0.85:
        return "Jawaban sangat sesuai dengan kunci jawaban."
    if skor >= THRESHOLD:
        return "Jawaban sesuai dengan kunci jawaban, meski ada bagian yang kurang lengkap."
    if skor >= 0.35:
        return "Jawaban hanya sebagian sesuai; beberapa poin kunci belum tercakup."
    return "Jawaban belum sesuai dengan kunci jawaban."


# ══════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════
class GradeRequest(BaseModel):
    soal: str = Field(..., min_length=1, max_length=2000)
    kunci_jawaban: str = Field(..., min_length=1, max_length=2000)
    jawaban_siswa: str = Field(..., min_length=1, max_length=3000)

    model_config = {"json_schema_extra": {"example": {
        "soal": "Sebutkan rukun iman!",
        "kunci_jawaban": "Rukun iman ada 6: iman kepada Allah, malaikat, kitab, rasul, hari akhir, dan qada qadar.",
        "jawaban_siswa": "Iman kepada Allah, malaikat, kitab, rasul, hari kiamat, takdir."}}}


class GradeResponse(BaseModel):
    skor: float = Field(..., ge=0, le=1, description="Skor mentah model, 0.0-1.0")
    nilai_100: float = Field(..., ge=0, le=100, description="skor x 100")
    alasan: str = Field(..., description="SELALU string, tidak pernah null")
    putusan: str = Field(..., description="BENAR / SALAH berdasarkan threshold")
    threshold: float = Field(..., description="Ambang yang dipakai")
    alasan_dari_model: bool = Field(..., description="False = template cadangan, bukan analisis model")


class HealthResponse(BaseModel):
    ok: bool
    ready: bool
    model_path: Optional[str] = None
    model_mode: Optional[str] = None
    threshold: Optional[float] = None


# ══════════════════════════════════════════════════════════════
# LIFESPAN
# ══════════════════════════════════════════════════════════════
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("=" * 60)
    log.info("Grader API (Qwen3 GGUF, fine-tuned)")
    log.info("=" * 60)

    if not os.path.isfile(MODEL_PATH):
        log.error(f"Model GGUF tidak ditemukan: {MODEL_PATH}")
        folder = os.path.dirname(MODEL_PATH)
        if os.path.isdir(folder):
            log.error(f"Isi folder {folder}: {os.listdir(folder)}")
        yield
        return

    threads = N_THREADS if N_THREADS > 0 else _detect_cpu_threads()
    log.info(f"Mode model : {MODEL_MODE}")
    log.info(f"Threshold  : {THRESHOLD}")
    log.info(f"Model      : {MODEL_PATH}")
    log.info(f"Context    : {N_CTX} | Threads: {threads} | GPU layers: {N_GPU_LAYERS}")
    if N_GPU_LAYERS == 0:
        log.warning("Berjalan di CPU murni — satu request bisa 20-60 detik.")
    if MODEL_MODE == "skor+alasan":
        log.warning("Mode skor+alasan: pastikan GGUF memang dilatih dgn MODE ini, "
                    "kalau tidak analisisnya akan kosong.")

    t0 = time.time()
    try:
        llm = Llama(
            model_path=MODEL_PATH, n_ctx=N_CTX, n_gpu_layers=N_GPU_LAYERS,
            n_threads=threads, n_batch=512, use_mlock=USE_MLOCK,
            use_mmap=True, verbose=False, chat_format="chatml",
        )
    except Exception as e:
        log.exception(f"Gagal load model: {e}")
        yield
        return

    state["llm"] = llm
    state["ready"] = True
    log.info(f"Model siap dalam {time.time() - t0:.1f} detik")
    log.info(f"Docs: http://localhost:{PORT}/docs")
    log.info("=" * 60)

    yield

    log.info("Shutting down...")
    state["llm"] = None
    state["ready"] = False


app = FastAPI(title="Grader AI API", version="3.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS,
                   allow_credentials=True, allow_methods=["GET", "POST"],
                   allow_headers=["*"])


# ══════════════════════════════════════════════════════════════
# INFERENCE
# ══════════════════════════════════════════════════════════════
def _prompt_chatml(user_msg: str, lanjutan: str = "") -> str:
    return (f"<|im_start|>system\n{SYSTEM_PROMPT}<|im_end|>\n"
            f"<|im_start|>user\n{user_msg}<|im_end|>\n"
            f"<|im_start|>assistant\n{lanjutan}")


def grade_essay(soal: str, kunci: str, jawaban: str) -> GradeResponse:
    llm = state["llm"]
    user_msg = _build_user_message(soal, kunci, jawaban)
    STOP = ["<|im_end|>", "</s>", "<|endoftext|>"]
    mode_alasan = (MODEL_MODE == "skor+alasan")
    max_tok = 250 if mode_alasan else 24

    # ── Tahap 1: generate ──
    resp = llm.create_chat_completion(
        messages=[{"role": "system", "content": SYSTEM_PROMPT},
                  {"role": "user",   "content": user_msg}],
        max_tokens=max_tok, temperature=0.0, top_p=1.0, stop=STOP,
    )
    raw = _bersihkan(resp["choices"][0]["message"]["content"] or "")
    log.info(f"[tahap1] RAW = {raw[:200]!r}")

    skor = _parse_skor(raw, izinkan_longgar=not mode_alasan)

    # ── Ambil analisis ──
    alasan, dari_model = None, False
    if mode_alasan:
        m = _RE_ALASAN.search(raw)
        if m and m.group(1).strip():
            alasan, dari_model = m.group(1).strip(), True

    # ── Tahap 2: kalau skor belum ketemu, lanjutkan dgn prefix "Skor: " ──
    if skor is None:
        if mode_alasan and alasan:
            # output terpotong sebelum baris Skor -> sambung dari analisis
            lanjutan = f"Analisis: {alasan}\nSkor: "
        else:
            lanjutan = "Skor: "
        r2 = llm.create_completion(prompt=_prompt_chatml(user_msg, lanjutan),
                                   max_tokens=8, temperature=0.0, top_p=1.0, stop=STOP)
        raw2 = _bersihkan(r2["choices"][0]["text"] or "")
        log.info(f"[tahap2] RAW = {raw2[:100]!r}")
        skor = _parse_skor("Skor: " + raw2, izinkan_longgar=True)

    if skor is None:
        raise HTTPException(
            status_code=502,
            detail=f"Model tidak menghasilkan skor. Output: {raw[:200]!r}")

    # ── alasan SELALU string ──
    if not alasan:
        alasan, dari_model = _alasan_cadangan(skor), False
        if mode_alasan:
            log.warning("Mode skor+alasan tapi analisis kosong -> pakai template cadangan. "
                        "Cek apakah GGUF benar-benar dilatih dgn MODE='skor+alasan'.")

    return GradeResponse(
        skor=round(skor, 3),
        nilai_100=round(skor * 100, 1),
        alasan=alasan,
        putusan="BENAR" if skor >= THRESHOLD else "SALAH",
        threshold=THRESHOLD,
        alasan_dari_model=dari_model,
    )


# ══════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════
@app.get("/", tags=["meta"])
def root():
    return {"name": "Grader AI API", "version": "3.1.0",
            "model_mode": MODEL_MODE, "threshold": THRESHOLD,
            "endpoints": {"health": "GET /health", "grade": "POST /grade",
                          "docs": "GET /docs"}}


@app.get("/health", response_model=HealthResponse, tags=["meta"])
def health():
    return HealthResponse(
        ok=True, ready=state["ready"],
        model_path=MODEL_PATH if state["ready"] else None,
        model_mode=MODEL_MODE if state["ready"] else None,
        threshold=THRESHOLD if state["ready"] else None,
    )


@app.post("/grade", response_model=GradeResponse, tags=["grading"])
def grade(req: GradeRequest):
    if not state["ready"]:
        raise HTTPException(status_code=503, detail="Model belum siap. Cek /health dan log server.")
    try:
        t0 = time.time()
        hasil = grade_essay(req.soal, req.kunci_jawaban, req.jawaban_siswa)
        log.info(f"grade -> skor={hasil.skor} putusan={hasil.putusan} "
                 f"alasan_model={hasil.alasan_dari_model} "
                 f"({int((time.time()-t0)*1000)}ms)")
        return hasil
    except HTTPException:
        raise
    except Exception as e:
        log.exception("Error saat grading")
        raise HTTPException(status_code=500, detail=f"Inference error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False)