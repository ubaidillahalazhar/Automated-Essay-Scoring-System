"""
FastAPI server untuk Grader AI.
Setup     : GPU NVIDIA + Windows native (tanpa WSL, tanpa bitsandbytes)
Quantize  : FP16 (no quantization) — butuh ~6-7 GB VRAM untuk Qwen 3B
Model     : safetensors merged (hasil Unsloth save_pretrained_merged)
Run       : python main.py   ATAU   uvicorn main:app --host 0.0.0.0 --port 8000
Docs      : http://localhost:8000/docs (Swagger UI auto-generated)
"""
import re
import time
import logging
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import AutoModelForCausalLM, AutoTokenizer

# ═══════════════════════════════════════════════════════════════════════
# KONFIGURASI
# ═══════════════════════════════════════════════════════════════════════
# Karena folder model ADA DI DALAM folder API (sejajar dengan main.py),
# pakai "./qwen3-grader-merged-8bit" — bukan "../"
MODEL_PATH = "./qwen3-grader-merged-8bit"

MAX_NEW_TOKENS = 96
ALLOWED_ORIGINS = [
    "http://localhost:3000",   # Express dev
    "http://localhost:5173",   # Vite dev
    # tambahkan domain production nanti
]

SYSTEM_PROMPT = """Kamu adalah asisten penilai jawaban ujian yang adil dan teliti.
Tugasmu adalah membandingkan jawaban siswa dengan kunci jawaban yang tersedia, lalu memberikan skor numerik antara 0.0 hingga 1.0 berdasarkan KEMIRIPAN MAKNA dan KELENGKAPAN jawaban.

Panduan skor:
  - 1.0       : Jawaban sangat lengkap & tepat, mencakup semua poin kunci
  - 0.7 - 0.9 : Jawaban cukup baik, mencakup sebagian besar poin penting
  - 0.4 - 0.6 : Jawaban sebagian benar atau kurang lengkap
  - 0.1 - 0.3 : Jawaban hampir tidak relevan, sangat sedikit kesesuaian
  - 0.0       : Jawaban sama sekali tidak relevan atau kosong

Jawab HANYA dalam format berikut (satu desimal):
Skor: <angka 0.0 - 1.0>
Alasan: <penjelasan singkat dalam Bahasa Indonesia>"""

# ═══════════════════════════════════════════════════════════════════════
# LOGGING
# ═══════════════════════════════════════════════════════════════════════
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("grader-api")

state = {"model": None, "tokenizer": None, "ready": False}

# ═══════════════════════════════════════════════════════════════════════
# LIFESPAN
# ═══════════════════════════════════════════════════════════════════════
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("=" * 60)
    log.info("🚀 Memulai Grader API (FP16, Windows native)")
    log.info("=" * 60)

    if not torch.cuda.is_available():
        raise RuntimeError(
            "GPU CUDA tidak terdeteksi. Pastikan driver NVIDIA & CUDA toolkit terinstall, "
            "dan PyTorch versi CUDA (bukan CPU-only) terpasang."
        )

    log.info(f"🎮 GPU      : {torch.cuda.get_device_name(0)}")
    log.info(f"💾 VRAM tot : {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
    log.info(f"📂 Model    : {MODEL_PATH}")

    t0 = time.time()
    log.info("⏳ Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)

    log.info("⏳ Loading model (FP16, no quantization)...")
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_PATH,
        device_map="auto",
        torch_dtype=torch.float16,    # FP16 — paling cocok untuk GPU NVIDIA modern
        low_cpu_mem_usage=True,
    )
    model.eval()

    state["model"] = model
    state["tokenizer"] = tokenizer
    state["ready"] = True

    log.info(f"✅ Model siap dalam {time.time() - t0:.1f} detik")
    log.info(f"💾 VRAM dipakai: {torch.cuda.memory_allocated() / 1e9:.2f} GB")
    log.info("=" * 60)
    log.info("📡 API listening di http://0.0.0.0:8000")
    log.info("📖 Swagger docs : http://localhost:8000/docs")
    log.info("=" * 60)

    yield

    log.info("👋 Shutting down, cleaning up GPU memory...")
    state["model"] = None
    state["tokenizer"] = None
    state["ready"] = False
    torch.cuda.empty_cache()


app = FastAPI(
    title="Grader AI API",
    description="API untuk menilai jawaban esai siswa otomatis menggunakan LLM fine-tuned.",
    version="1.0.0",
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
# SCHEMAS
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
    skor: float | None = Field(..., description="Skor 0.0 - 1.0, atau null jika gagal parse")
    nilai_100: int | None = Field(..., description="Skor dikonversi ke skala 0-100")
    kategori: str | None = Field(..., description="salah / sebagian / benar")
    alasan: str | None = Field(..., description="Penjelasan singkat dari model")
    waktu_proses_ms: int = Field(..., description="Lama inference dalam milidetik")
    raw: str = Field(..., description="Output mentah model untuk debugging")

class BatchItem(BaseModel):
    id: str | int | None = None
    soal: str
    kunci_jawaban: str
    jawaban_siswa: str

class BatchRequest(BaseModel):
    items: list[BatchItem] = Field(..., min_length=1, max_length=50,
                                   description="Maksimal 50 item per batch")

class HealthResponse(BaseModel):
    ok: bool
    ready: bool
    gpu: str | None
    vram_used_gb: float | None
    vram_total_gb: float | None

# ═══════════════════════════════════════════════════════════════════════
# CORE INFERENCE
# ═══════════════════════════════════════════════════════════════════════
def build_prompt(soal: str, kunci: str, jawaban: str) -> str:
    return (
        f"Soal: {soal.strip()}\n\n"
        f"Kunci Jawaban: {kunci.strip()}\n\n"
        f"Jawaban Siswa: {jawaban.strip()}\n\n"
        f"Berikan penilaian dalam format:\n"
        f"Skor: <angka 0.0 - 1.0>\n"
        f"Alasan: <penjelasan singkat>"
    )

def parse_output(text: str) -> tuple[float | None, str | None]:
    skor = None
    skor_match = re.search(r'Skor\s*[:=]\s*([01](?:[.,]\d+)?)', text, re.IGNORECASE)
    if skor_match:
        try:
            skor = float(skor_match.group(1).replace(',', '.'))
            skor = max(0.0, min(1.0, skor))
        except ValueError:
            pass

    alasan = None
    alasan_match = re.search(r'Alasan\s*[:=]\s*(.+)', text, re.IGNORECASE | re.DOTALL)
    if alasan_match:
        alasan = alasan_match.group(1).strip()

    return skor, alasan

def kategori_dari_skor(skor: float | None) -> str | None:
    if skor is None: return None
    if skor < 0.35: return "salah"
    if skor < 0.70: return "sebagian"
    return "benar"

def generate_skor(soal: str, kunci: str, jawaban: str) -> dict:
    if not state["ready"]:
        raise HTTPException(503, "Model belum siap, tunggu startup selesai.")

    tokenizer = state["tokenizer"]
    model = state["model"]

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": build_prompt(soal, kunci, jawaban)},
    ]

    input_text = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    inputs = tokenizer(input_text, return_tensors="pt").to(model.device)

    t0 = time.time()
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=MAX_NEW_TOKENS,
            do_sample=False,
            temperature=0.1,
            pad_token_id=tokenizer.eos_token_id,
        )
    elapsed_ms = int((time.time() - t0) * 1000)

    new_tokens = outputs[0][inputs["input_ids"].shape[1]:]
    response_text = tokenizer.decode(new_tokens, skip_special_tokens=True).strip()

    skor, alasan = parse_output(response_text)

    return {
        "skor": skor,
        "nilai_100": int(round(skor * 100)) if skor is not None else None,
        "kategori": kategori_dari_skor(skor),
        "alasan": alasan,
        "waktu_proses_ms": elapsed_ms,
        "raw": response_text,
    }

# ═══════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════
@app.get("/", tags=["meta"])
def root():
    return {
        "name": "Grader AI API",
        "version": "1.0.0",
        "endpoints": {
            "health": "GET /health",
            "grade": "POST /grade",
            "grade_batch": "POST /grade-batch",
            "docs": "GET /docs"
        }
    }

@app.get("/health", response_model=HealthResponse, tags=["meta"])
def health():
    cuda_ok = torch.cuda.is_available()
    return HealthResponse(
        ok=True,
        ready=state["ready"],
        gpu=torch.cuda.get_device_name(0) if cuda_ok else None,
        vram_used_gb=round(torch.cuda.memory_allocated() / 1e9, 2) if cuda_ok else None,
        vram_total_gb=round(torch.cuda.get_device_properties(0).total_memory / 1e9, 1) if cuda_ok else None,
    )

@app.post("/grade", response_model=GradeResponse, tags=["grading"])
def grade(req: GradeRequest):
    """Nilai SATU jawaban siswa. Cocok untuk request real-time dari UI."""
    try:
        result = generate_skor(req.soal, req.kunci_jawaban, req.jawaban_siswa)
        log.info(f"grade -> skor={result['skor']} ({result['waktu_proses_ms']}ms)")
        return result
    except HTTPException:
        raise
    except Exception as e:
        log.exception("Error saat grading")
        raise HTTPException(500, f"Inference error: {e}")

@app.post("/grade-batch", tags=["grading"])
def grade_batch(req: BatchRequest):
    """Nilai BANYAK jawaban sekaligus (max 50 per request)."""
    results = []
    t0 = time.time()
    for item in req.items:
        try:
            r = generate_skor(item.soal, item.kunci_jawaban, item.jawaban_siswa)
            results.append({"id": item.id, **r})
        except Exception as e:
            results.append({"id": item.id, "error": str(e)})

    elapsed_ms = int((time.time() - t0) * 1000)
    valid = sum(1 for r in results if "error" not in r)
    log.info(f"grade-batch -> {valid}/{len(results)} sukses ({elapsed_ms}ms)")
    return {
        "total": len(results),
        "sukses": valid,
        "gagal": len(results) - valid,
        "waktu_proses_ms": elapsed_ms,
        "results": results,
    }


# ═══════════════════════════════════════════════════════════════════════
# ENTRYPOINT — supaya `python main.py` bisa langsung jalan
# ═══════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)