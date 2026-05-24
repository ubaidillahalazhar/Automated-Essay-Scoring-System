"""
FastAPI server untuk Grader AI.
Setup     : CPU-only (atau GPU opsional), Qwen3 GGUF format
Library   : llama-cpp-python (bukan transformers)
Model     : Qwen3 GGUF Q4_K_M (~2.5GB RAM untuk 4B)
Run       : python main.py   ATAU   uvicorn main:app --host 0.0.0.0 --port 8000
Docs      : http://localhost:8000/docs

Endpoint /grade dipanggil oleh backend/src/services/aiService.js
Payload : {soal, kunci_jawaban, jawaban_siswa}
Response: {skor, nilai_100, alasan}  -- HANYA 3 field sesuai aiService.js
"""
import json
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

# ═══════════════════════════════════════════════════════════════════════
# LOAD CONFIG
# ═══════════════════════════════════════════════════════════════════════
load_dotenv()

MODEL_PATH    = os.getenv("MODEL_PATH", "D:/Automated-Essay-Scoring-System/ai-service/models/qwen3-grader-q_4_km.gguf")
N_CTX         = int(os.getenv("N_CTX", "4096"))
N_GPU_LAYERS  = int(os.getenv("N_GPU_LAYERS", "0"))      # 0 = CPU only
N_THREADS     = int(os.getenv("N_THREADS", "0"))         # 0 = auto
MAX_TOKENS    = int(os.getenv("MAX_TOKENS", "512"))
TEMPERATURE   = float(os.getenv("TEMPERATURE", "0.3"))
USE_MLOCK     = os.getenv("USE_MLOCK", "true").lower() in ("1", "true", "yes")
HOST          = os.getenv("HOST", "0.0.0.0")
PORT          = int(os.getenv("PORT", "8000"))

ALLOWED_ORIGINS = [
    "http://localhost:3000",   # Next.js frontend
    "http://localhost:5000",   # Express backend (jaga-jaga)
    "http://localhost:5173",   # Vite (jaga-jaga)
    # Tambahkan domain production di sini kalau perlu
]

SYSTEM_PROMPT = """Anda adalah asisten penilai jawaban esai yang adil dan teliti dalam Bahasa Indonesia.

Tugas Anda:
1. Bandingkan jawaban siswa dengan kunci jawaban berdasarkan kebenaran konsep, kelengkapan, dan kejelasan.
2. Beri skor 0-10 (boleh desimal seperti 7.5).
3. Hitung nilai_100 = skor x 10.
4. Berikan alasan singkat 1-2 kalimat dalam Bahasa Indonesia.

PENTING: Balas HANYA dengan JSON valid, tanpa teks lain, tanpa markdown, tanpa code fence, tanpa thinking tags.
Format wajib: {"skor": <0-10>, "nilai_100": <0-100>, "alasan": "<teks>"}"""

# ═══════════════════════════════════════════════════════════════════════
# LOGGING
# ═══════════════════════════════════════════════════════════════════════
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("grader-api")

state = {"llm": None, "ready": False}


# ═══════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════
def _detect_cpu_threads() -> int:
    """Pakai physical core (bukan logical). Hyperthreading sering bikin
    llama.cpp lebih lambat, bukan lebih cepat."""
    try:
        import psutil
        cores = psutil.cpu_count(logical=False)
        if cores:
            return cores
    except ImportError:
        pass
    cores = os.cpu_count() or 4
    return max(1, cores // 2)


def _strip_thinking(text: str) -> str:
    """Qwen3 reasoning variant kadang masih output <think>...</think>.
    Hapus blok thinking biar JSON parser ga ketabrak."""
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    text = re.sub(r"<thinking>.*?</thinking>", "", text, flags=re.DOTALL)
    return text


def _extract_json(text: str) -> Optional[dict]:
    """Brace-matching parser - robust terhadap teks ekstra di luar JSON."""
    text = _strip_thinking(text)
    text = re.sub(r"```(?:json)?", "", text).strip()

    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start : i + 1])
                except json.JSONDecodeError:
                    return None
    return None


# ═══════════════════════════════════════════════════════════════════════
# LIFESPAN
# ═══════════════════════════════════════════════════════════════════════
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("=" * 60)
    log.info("Memulai Grader API (Qwen3 GGUF)")
    log.info("=" * 60)

    if not os.path.isfile(MODEL_PATH):
        log.error(f"Model GGUF tidak ditemukan di: {MODEL_PATH}")
        log.error("Pastikan file .gguf sudah di-download dan MODEL_PATH benar di .env")
        # Tetap yield supaya server hidup (biar /health bisa dicek), tapi grader belum siap
        yield
        return

    threads = N_THREADS if N_THREADS > 0 else _detect_cpu_threads()
    mode = "GPU" if N_GPU_LAYERS > 0 else "CPU"

    log.info(f"Mode      : {mode}")
    log.info(f"Model     : {MODEL_PATH}")
    log.info(f"Context   : {N_CTX} tokens")
    log.info(f"Threads   : {threads}")
    log.info(f"GPU layers: {N_GPU_LAYERS}")
    log.info(f"mlock     : {USE_MLOCK}")

    t0 = time.time()
    log.info("Loading GGUF model...")

    try:
        llm = Llama(
            model_path=MODEL_PATH,
            n_ctx=N_CTX,
            n_gpu_layers=N_GPU_LAYERS,
            n_threads=threads,
            n_batch=512,
            use_mlock=USE_MLOCK,
            use_mmap=True,
            verbose=False,
            chat_format="chatml",  # Qwen3 pakai ChatML
        )
    except Exception as e:
        log.exception(f"Gagal load model: {e}")
        yield
        return

    state["llm"] = llm
    state["ready"] = True

    log.info(f"Model siap dalam {time.time() - t0:.1f} detik")
    log.info("=" * 60)
    log.info(f"API listening di http://{HOST}:{PORT}")
    log.info(f"Swagger docs   : http://localhost:{PORT}/docs")
    log.info("=" * 60)

    yield

    log.info("Shutting down...")
    state["llm"] = None
    state["ready"] = False


app = FastAPI(
    title="Grader AI API",
    description="API untuk menilai jawaban esai siswa menggunakan Qwen3 GGUF (CPU-optimized).",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════════════
# SCHEMAS (SIMPLIFIED - 3 fields only)
# ═══════════════════════════════════════════════════════════════════════
class GradeRequest(BaseModel):
    soal: str = Field(..., min_length=1, max_length=2000,
                      description="Pertanyaan/soal ujian")
    kunci_jawaban: str = Field(..., min_length=1, max_length=2000,
                               description="Kunci jawaban referensi dari guru")
    jawaban_siswa: str = Field(..., min_length=1, max_length=3000,
                               description="Jawaban yang diberikan siswa")

    model_config = {
        "json_schema_extra": {
            "example": {
                "soal": "Sebutkan rukun iman!",
                "kunci_jawaban": "Rukun iman ada 6: iman kepada Allah, malaikat, kitab, rasul, hari akhir, dan qada qadar.",
                "jawaban_siswa": "Iman kepada Allah, malaikat, kitab, rasul, hari kiamat, takdir."
            }
        }
    }


class GradeResponse(BaseModel):
    """Schema sesuai kontrak aiService.js - 3 field saja."""
    skor: float = Field(..., ge=0, le=10, description="Skor 0-10")
    nilai_100: float = Field(..., ge=0, le=100, description="Skor dikonversi ke skala 0-100")
    alasan: str = Field(..., description="Penjelasan singkat dari model")


class HealthResponse(BaseModel):
    ok: bool
    ready: bool
    model_path: Optional[str]
    mode: Optional[str]


# ═══════════════════════════════════════════════════════════════════════
# CORE INFERENCE
# ═══════════════════════════════════════════════════════════════════════
def _build_user_message(soal: str, kunci: str, jawaban: str) -> str:
    return (
        f"Soal:\n{soal.strip()}\n\n"
        f"Kunci Jawaban:\n{kunci.strip()}\n\n"
        f"Jawaban Siswa:\n{jawaban.strip()}\n\n"
        f"Nilai jawaban siswa di atas. Balas hanya JSON tanpa thinking, tanpa penjelasan tambahan."
    )


def _raw_inference(soal: str, kunci: str, jawaban: str) -> str:
    llm = state["llm"]
    resp = llm.create_chat_completion(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_message(soal, kunci, jawaban)},
        ],
        max_tokens=MAX_TOKENS,
        temperature=TEMPERATURE,
        top_p=0.9,
        stop=["</s>", "<|im_end|>"],
    )
    return resp["choices"][0]["message"]["content"]


def _normalize(data: dict) -> GradeResponse:
    """Pastikan output valid dan dalam range yang benar."""
    skor = float(data.get("skor", 0))
    skor = max(0.0, min(10.0, skor))

    nilai_100 = data.get("nilai_100")
    if nilai_100 is None:
        nilai_100 = skor * 10
    nilai_100 = max(0.0, min(100.0, float(nilai_100)))

    alasan = str(data.get("alasan", "")).strip() or "Tidak ada alasan dari model."

    return GradeResponse(skor=skor, nilai_100=nilai_100, alasan=alasan)


def grade_essay(soal: str, kunci: str, jawaban: str) -> GradeResponse:
    """Inference utama dengan retry jika JSON parsing gagal."""
    last_raw = ""
    for attempt in range(2):
        raw = _raw_inference(soal, kunci, jawaban)
        last_raw = raw
        data = _extract_json(raw)
        if data is not None:
            return _normalize(data)
        log.warning(f"Attempt {attempt + 1}: JSON parse gagal. Raw: {raw[:200]}")

    # Fallback: jika 2x gagal parse, kembalikan skor 0 dengan alasan error
    return GradeResponse(
        skor=0.0,
        nilai_100=0.0,
        alasan=f"Model gagal mengembalikan JSON valid setelah 2 percobaan. Raw output: {last_raw[:150]}",
    )


# ═══════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════
@app.get("/", tags=["meta"])
def root():
    return {
        "name": "Grader AI API",
        "version": "2.0.0",
        "model": "Qwen3 GGUF (CPU)",
        "endpoints": {
            "health": "GET /health",
            "grade": "POST /grade",
            "docs": "GET /docs"
        }
    }


@app.get("/health", response_model=HealthResponse, tags=["meta"])
def health():
    return HealthResponse(
        ok=True,
        ready=state["ready"],
        model_path=MODEL_PATH if state["ready"] else None,
        mode=("GPU" if N_GPU_LAYERS > 0 else "CPU") if state["ready"] else None,
    )


@app.post("/grade", response_model=GradeResponse, tags=["grading"])
def grade(req: GradeRequest):
    """Nilai SATU jawaban siswa. Endpoint utama yang dipanggil oleh backend Node.js."""
    if not state["ready"]:
        raise HTTPException(
            status_code=503,
            detail="Model belum siap. Cek /health dan log server.",
        )

    try:
        t0 = time.time()
        result = grade_essay(req.soal, req.kunci_jawaban, req.jawaban_siswa)
        elapsed = int((time.time() - t0) * 1000)
        log.info(f"grade -> skor={result.skor} nilai_100={result.nilai_100} ({elapsed}ms)")
        return result
    except Exception as e:
        log.exception("Error saat grading")
        raise HTTPException(status_code=500, detail=f"Inference error: {e}")


# ═══════════════════════════════════════════════════════════════════════
# ENTRYPOINT
# ═══════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False)