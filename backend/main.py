import os
import json
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from ml_service import ml_service
from verification import verify_application
from fraud_detector import detect_fraud

load_dotenv()

app = FastAPI(title="AgroScore AI DSS API — Племенное Животноводство")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)

# ─── Data Loading ────────────────────────────────────────────────────────────
# Priority: 1) AGROSCORE_FINAL_AUDIT_2025.csv (pre-calculated national registry)
#           2) merit_scoring_final_audit.csv   (fallback)
#           3) raw xlsx                        (last resort)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

NATIONAL_AUDIT  = os.path.join(BASE_DIR, "AGROSCORE_FINAL_AUDIT_2025.csv")
LEGACY_AUDIT    = os.path.join(BASE_DIR, "merit_scoring_final_audit.csv")
DATA_PATH       = os.path.join(BASE_DIR, "merit_scoring_dataset_33k.xlsx")

if os.path.exists(NATIONAL_AUDIT):
    df_browser = pd.read_csv(NATIONAL_AUDIT)
    # Sort by ai_score descending → national ranking on first page
    if 'ai_score' in df_browser.columns:
        df_browser = df_browser.sort_values('ai_score', ascending=False).reset_index(drop=True)
    print(f"✅ National Registry loaded: {len(df_browser):,} records from AGROSCORE_FINAL_AUDIT_2025.csv")
elif os.path.exists(LEGACY_AUDIT):
    df_browser = pd.read_csv(LEGACY_AUDIT)
    print(f"⚠️  Fallback: loaded {len(df_browser):,} records from merit_scoring_final_audit.csv")
else:
    df_browser_raw = pd.read_excel(DATA_PATH)
    df_browser = df_browser_raw.loc[:, ~df_browser_raw.columns.str.contains('^Unnamed')].copy()
    print(f"⚠️  Last resort: loaded {len(df_browser):,} records from raw Excel")

TOTAL_COUNT = len(df_browser)

# Pre-calculate global averages for Dashboard Radar
GLOBAL_RADAR_AVGS = {
    "Продуктивность":        round(float(df_browser['ai_score'].mean()), 1) if 'ai_score' in df_browser else 57.0,
    "Сохранность стада":     round(float((1 - df_browser['Показатель падежа скота'].fillna(0)).mean() * 100), 1),
    "Технологичность":       round(float((df_browser['Наличие автоматизации'] == 1).mean() * 100), 1),
    "Юридическая история":   round(float((df_browser['История нарушений'] == 0).mean() * 100), 1),
    "Региональное соответствие": 82.5
}

# Audit log in project root
AUDIT_LOG_PATH = os.path.join(BASE_DIR, "audit_log.jsonl")

class AnalysisRequest(BaseModel):
    farmer_data: dict
    lang: str = "RU"

class AuditRecord(BaseModel):
    application_id: str
    actual_outcome: str  # "approved" | "rejected" | "fraud_confirmed"
    auditor_notes: str = ""
    farmer_data: dict = {}

@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": ml_service.model is not None}

@app.get("/applications")
async def get_applications(page: int = 1, size: int = 50, response: Response = None):
    start = (page - 1) * size
    end = start + size
    subset = df_browser.iloc[start:end]
    
    # Add Total count header for the frontend
    response.headers["X-Total-Count"] = str(TOTAL_COUNT)
    return Response(content=subset.to_json(orient='records'), media_type="application/json")

@app.get("/analytics")
async def get_analytics():
    scores = df_browser['ai_score'].fillna(0).values if 'ai_score' in df_browser else df_browser['target_efficiency'].fillna(0).values

    # Histogram
    hist, bin_edges = np.histogram(scores, bins=[0, 20, 40, 60, 75, 85, 100])
    histogram_data = [
        {"range": f"{int(bin_edges[i])}-{int(bin_edges[i+1])}", "count": int(hist[i])}
        for i in range(len(hist))
    ]

    # Region distribution
    region_counts = df_browser['Область'].value_counts().head(5).to_dict()
    region_data = [{"name": k, "value": v} for k, v in region_counts.items()]

    # TOP Regions by efficiency
    if 'ai_score' in df_browser:
        region_avg = df_browser.groupby('Область')['ai_score'].mean().sort_values(ascending=False).head(5)
        top_regions = [{"name": k, "score": round(float(v), 1)} for k, v in region_avg.items()]
    else:
        top_regions = []

    # Recommendation counts from pre-calculated column
    if 'system_recommendation' in df_browser.columns:
        rec_counts = df_browser['system_recommendation'].value_counts().to_dict()
        approved   = int(rec_counts.get("ОДОБРИТЬ",  0))
        check      = int(rec_counts.get("ПРОВЕРИТЬ", 0))
        rejected   = int(rec_counts.get("ОТКАЗАТЬ",  0))
    else:
        approved  = int(np.sum(scores >= 70))
        check     = int(np.sum(df_browser.get('anomaly_flag', pd.Series(False)) == True))
        rejected  = int(np.sum(scores < 40))

    return {
        "total_evaluated": TOTAL_COUNT,
        "avg_score": round(float(np.mean(scores)), 1),
        "histogram": histogram_data,
        "region_distribution": region_data,
        "top_regions": top_regions,
        "global_radar": [{"subject": k, "A": v} for k, v in GLOBAL_RADAR_AVGS.items()],
        "recommendations": {
            "approved": approved,
            "check":    check,
            "rejected": rejected
        },
        "anti_fraud": {
            "verified":          TOTAL_COUNT - check - rejected,
            "high_risk":         check,
            "likely_falsified":  int(np.sum(scores <= 15))
        }
    }

@app.post("/upload/manual")
async def upload_manual(data: dict):
    # Field validation (IIN length: 12)
    iin = str(data.get("iin", ""))
    if len(iin) != 12:
        return {"status": "error", "message": "Некорректный ИИН/БИН (должен быть 12 цифр)"}
    return {"status": "success", "message": "Заявитель добавлен в реестр (симуляция)"}

@app.post("/analyze")
async def analyze_application(req: AnalysisRequest):
    try:
        # Use existing pre-calculated score if available for 33k rows
        farmer_data = req.farmer_data
        
        # 1. ML Score + SHAP (Only full analysis if not found)
        # We try to find the row in df_browser by IIN/BIN if possible
        # For demo purposes, we usually rely on current farmer_data
        result = ml_service.predict(farmer_data)
        
        # 2. Gov System Verification (ИСЖ/ИБСПР/КГИ)
        verification = verify_application(farmer_data)
        result["verification"] = verification.to_dict()

        # 3. Biological Norm Anti-Fraud Check
        fraud = detect_fraud(farmer_data)
        result["fraud"] = fraud.to_dict()

        # 4. Verdict logic
        score = result["score"]
        if fraud.requires_field_inspection:
            verdict_directive = "РЕКОМЕНДОВАНА ПРОВЕРКА"
        elif score >= 70:
            verdict_directive = "РЕКОМЕНДОВАНО К ОДОБРЕНИЮ"
        else:
            verdict_directive = "РЕКОМЕНДОВАН ОТКАЗ"

        result["verdict_status"] = verdict_directive

        # LLM Verdict (Groq)
        try:
            import openai
            client = openai.OpenAI(base_url="https://api.groq.com/openai/v1", api_key=os.getenv("GROQ_API_KEY"))
            SYSTEM_PROMPT = "Эксперт МСХ РК. Короткий вердикт на основании агро-данных."
            user_msg = f"Score: {score}. Резюме: {verdict_directive}."
            chat = client.chat.completions.create(
                messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_msg}],
                model="llama-3.3-70b-versatile",
                max_tokens=60,
                temperature=0.2,
            )
            result["explanation"] = chat.choices[0].message.content.strip()
        except:
            result["explanation"] = f"{verdict_directive}. Скоринг эффективности: {score:.0f}."

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/feedback")
async def submit_feedback(record: AuditRecord):
    with open(AUDIT_LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(record.dict(), ensure_ascii=False) + "\n")
    return {"status": "saved"}
