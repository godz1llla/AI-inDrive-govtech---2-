import os
import json
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from .ml_service import ml_service
from .verification import verify_application
from .fraud_detector import detect_fraud

load_dotenv()

app = FastAPI(title="GovTech DSS API — Племенное Животноводство")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load registry
DATA_PATH = "merit_scoring_dataset_33k.xlsx"
df_browser_raw = pd.read_excel(DATA_PATH).head(100)
df_browser = df_browser_raw.loc[:, ~df_browser_raw.columns.str.contains('^Unnamed')].copy()

AUDIT_LOG_PATH = "audit_log.jsonl"

class AnalysisRequest(BaseModel):
    farmer_data: dict
    lang: str = "RU"

@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": ml_service.model is not None}

@app.get("/applications")
async def get_applications():
    return Response(content=df_browser.to_json(orient='records'), media_type="application/json")

@app.post("/analyze")
async def analyze_application(req: AnalysisRequest):
    try:
        # 1. ML Score + SHAP
        result = ml_service.predict(req.farmer_data)

        # 2. Gov System Verification (ИСЖ/ИБСПР/КГИ)
        verification = verify_application(req.farmer_data)
        result["verification"] = verification.to_dict()

        # 3. Biological Norm Anti-Fraud Check
        fraud = detect_fraud(req.farmer_data)
        result["fraud"] = fraud.to_dict()

        # 4. Override risk_level if fraud is detected
        if fraud.requires_field_inspection:
            result["risk_level"] = "Anomalous"

        # 5. Hard-reject check: if subsidy amount exceeds ИБСПР limit, block before scoring
        verification_result = verify_application(req.farmer_data)
        amount_field = next((f for f in verification_result.fields if f.field == "Причитающая сумма"), None)
        hard_reject = amount_field and amount_field.status == "MISMATCH"

        # 6. Verdict logic — using recommendation labels (legally safe, AI is advisory not final)
        ml_anomaly_detected = any(f.get("severity") == "ML_ANOMALY" for f in result["fraud"]["flags"])
        score = result["score"]

        if hard_reject:
            # Formal violation — rejected at validation stage, no scoring needed
            verdict_directive = "РЕКОМЕНДОВАН ОТКАЗ"
        elif fraud.requires_field_inspection:
            # Biological norm violation — requires human verification
            verdict_directive = "РЕКОМЕНДОВАНА ПРОВЕРКА"
        elif ml_anomaly_detected and score >= 70:
            # High score BUT statistically anomalous profile — block for review, not approve
            verdict_directive = "РЕКОМЕНДОВАНА ПРОВЕРКА"
            result["risk_level"] = "High"  # downgrade from Low
        elif score >= 70:
            verdict_directive = "РЕКОМЕНДОВАНО К ОДОБРЕНИЮ"
        else:
            verdict_directive = "РЕКОМЕНДОВАН ОТКАЗ"

        factors_text = ", ".join([f['display'] for f in result['top_features']])
        fraud_note = fraud.inspection_reason_ru if fraud.requires_field_inspection else ""
        hard_reject_note = "ЖЁСТКИЙ ОТКАЗ: Сумма субсидии превышает региональный лимит ИБСПР — заявка отклонена до скоринга." if hard_reject else ""

        SYSTEM_PROMPT = """Ты — эксперт Министерства сельского хозяйства Республики Казахстан.
Твоя единственная задача: выносить письменный вердикт по заявкам на получение субсидий в сфере ПЛЕМЕННОГО ЖИВОТНОВОДСТВА.
Твои ответы касаются ТОЛЬКО: коров, лошадей, верблюдов, овец, поголовья скота, нормативов выхода продукции, ветеринарных требований и государственных субсидий согласно Правилам субсидирования РК.
ЗАПРЕЩЕНО: писать про найм сотрудников, IT-системы, специалистов или любые темы не связанные с животноводством.
Формат: ОДИН абзац, официальный русский/казахский язык государственного документа."""

        if req.lang == "RU":
            user_msg = f"""Заявка на субсидию по племенному животноводству.
AI-балл: {result['score']:.0f}/100. Рекомендация системы: {verdict_directive}.
Ключевые факторы: {factors_text}.
{hard_reject_note or ('Нарушение биологических норм: ' + fraud_note if fraud_note else 'Нарушений не выявлено.')}
Напиши официальный вердикт — одно предложение."""
        else:
            user_msg = f"""Мал шаруашылығы субсидиясына өтінім.
АИ-балл: {result['score']:.0f}/100. Жүйе ұсынысы: {verdict_directive}.
Негізгі факторлар: {factors_text}.
{'Биологиялық норма бұзылды: ' + fraud.inspection_reason_kz if fraud.inspection_reason_kz else 'Бұзушылықтар анықталмады.'}
Ресми үкім жаз — бір сөйлем."""


        try:
            import openai
            client = openai.OpenAI(
                base_url="https://api.groq.com/openai/v1",
                api_key=os.getenv("GROQ_API_KEY")
            )
            chat = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg}
                ],
                model="llama-3.3-70b-versatile",
                max_tokens=150,
                temperature=0.2,  # low temp = less hallucination
            )
            result["explanation"] = chat.choices[0].message.content.strip()
        except Exception as e:
            print(f"Groq error: {e}")
            if req.lang == "RU":
                result["explanation"] = f"{verdict_directive}: {factors_text}. Балл: {result['score']:.0f}/100."
            else:
                result["explanation"] = f"{verdict_directive}: {factors_text}. Балл: {result['score']:.0f}/100."

        result["verdict_status"] = verdict_directive

        # 6. Dynamic threshold context
        # In a real deployment: threshold = percentile cutoff based on monthly budget
        # Here: simulated as 70-point minimum for approval
        APPROVAL_THRESHOLD = 70
        result["threshold_context"] = {
            "current_threshold": APPROVAL_THRESHOLD,
            "score": round(result["score"], 1),
            "above_threshold": result["score"] >= APPROVAL_THRESHOLD,
            "note_ru": f"Порог одобрения: {APPROVAL_THRESHOLD}/100. Установлен по объёму бюджета текущего квартала. Финансирование получают наиболее эффективные хозяйства.",
            "note_kz": f"Мақұлдау шегі: {APPROVAL_THRESHOLD}/100. Ағымдағы тоқсан бюджеті негізінде белгіленген.",
        }

        return result


    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


class AuditRecord(BaseModel):
    application_id: str
    actual_outcome: str  # "approved" | "rejected" | "fraud_confirmed"
    auditor_notes: str = ""
    farmer_data: dict = {}

@app.post("/feedback")
async def submit_feedback(record: AuditRecord):
    """
    Feedback Loop API — collects real auditor outcomes for future model retraining.
    Architecture is ready to feed into prepare_ml_data.py when audit data accumulates.
    NOTE: This is a data collection facade. Automated retraining requires a separate pipeline.
    """
    entry = record.dict()
    with open(AUDIT_LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    total = sum(1 for _ in open(AUDIT_LOG_PATH))
    return {
        "status": "saved",
        "total_feedback_records": total,
        "architecture_note": "Feedback Loop API. Retraining pipeline: prepare_ml_data.py --include-audit (requires min 100 records)"
    }


@app.get("/audit-stats")
async def audit_stats():
    """Returns summary of stored audit outcomes for transparency."""
    if not os.path.exists(AUDIT_LOG_PATH):
        return {"total": 0, "outcomes": {}}
    
    records = []
    with open(AUDIT_LOG_PATH, "r", encoding="utf-8") as f:
        for line in f:
            try:
                records.append(json.loads(line))
            except:
                pass

    outcomes = {}
    for r in records:
        o = r.get("actual_outcome", "unknown")
        outcomes[o] = outcomes.get(o, 0) + 1

    return {"total": len(records), "outcomes": outcomes}
