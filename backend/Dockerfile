# ──────────────────────────────────────────────────────────
# AgroScore AI — Backend Dockerfile
# FastAPI + CatBoost + SHAP + Groq LLM
# ──────────────────────────────────────────────────────────
FROM python:3.12-slim

# System deps for CatBoost and SHAP (requires gcc/g++)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifest first (layer caching)
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy full project (main.py imports dataset from /app root)
COPY backend/ ./backend/
COPY backend/merit_model.cbm ./backend/merit_model.cbm
COPY merit_scoring_dataset_33k.xlsx ./merit_scoring_dataset_33k.xlsx

# Expose API port
EXPOSE 8001

# Run app from project root so relative paths resolve correctly
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8001"]
