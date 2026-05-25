

FROM python:3.11-slim

# Install runtime dependencies (libgomp untuk OpenMP, curl untuk healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set working directory
WORKDIR /app

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Install dependencies - GUNAKAN PREBUILT WHEEL untuk llama-cpp-python
# Ini menghindari compile dari source yang sering fail
COPY requirements.txt .
RUN pip install --no-cache-dir fastapi==0.115.0 \
                              "uvicorn[standard]==0.32.0" \
                              pydantic==2.9.2 \
                              python-dotenv==1.0.1 \
                              psutil==6.0.0

# Install llama-cpp-python dari prebuilt wheel (CPU version)
RUN pip install --no-cache-dir \
    --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu \
    llama-cpp-python

# Verify llama_cpp ter-install
RUN python -c "import llama_cpp; print('llama_cpp OK:', llama_cpp.__file__)"

# Copy application files
COPY main.py .
COPY .env .env

# Copy model file (3-4GB) - heaviest layer, copy last untuk cache optimization
COPY models/ ./models/

# Environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["python", "main.py"]
