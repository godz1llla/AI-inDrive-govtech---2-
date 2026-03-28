"""
Hybrid Anti-Fraud Module: Rules + Isolation Forest (ML)

Architecture:
1. Rule-based layer — interpretable, legally defensible (required for gov systems)
2. Isolation Forest layer — catches non-obvious statistical anomalies rules miss

Why hybrid? Pure ML fails audit trails (can't explain to court).
Pure rules are gameable. Hybrid is the industry standard (Visa, Mastercard).
"""

import numpy as np
from dataclasses import dataclass, field
from typing import List
from sklearn.ensemble import IsolationForest

@dataclass
class FraudFlag:
    code: str
    severity: str  # "HIGH", "MEDIUM", "LOW", "ML_ANOMALY"
    description_ru: str
    description_kz: str
    rule_reference: str

@dataclass
class FraudReport:
    flags: List[FraudFlag] = field(default_factory=list)
    requires_field_inspection: bool = False
    inspection_reason_ru: str = ""
    inspection_reason_kz: str = ""
    ml_anomaly_score: float = 0.0  # Isolation Forest anomaly score

    def to_dict(self):
        return {
            "flags": [
                {
                    "code": f.code,
                    "severity": f.severity,
                    "description_ru": f.description_ru,
                    "description_kz": f.description_kz,
                    "rule_reference": f.rule_reference,
                }
                for f in self.flags
            ],
            "requires_field_inspection": self.requires_field_inspection,
            "inspection_reason_ru": self.inspection_reason_ru,
            "inspection_reason_kz": self.inspection_reason_kz,
            "ml_anomaly_score": round(self.ml_anomaly_score, 4),
        }


# ─── Isolation Forest: trained on "normal" application profile ───────────────
# In production: retrain on entire registry. Here: seeded with biological norms.
def _build_isolation_forest():
    # Seed with synthetic "normal" profiles (growth, mortality, amount, automation)
    rng = np.random.default_rng(42)
    normal_profiles = np.column_stack([
        rng.uniform(0.05, 0.30, 500),   # growth 5–30%
        rng.uniform(0.00, 0.05, 500),   # mortality 0–5%
        rng.uniform(100_000, 20_000_000, 500),  # subsidy amount
        rng.integers(0, 2, 500),        # automation
        rng.integers(0, 2, 500),        # violations
    ])
    iso = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    iso.fit(normal_profiles)
    return iso

_iso_forest = _build_isolation_forest()


def detect_fraud(farmer_data: dict) -> FraudReport:
    report = FraudReport()

    growth = float(farmer_data.get("Процент роста продукции", 0) or 0)
    mortality = float(farmer_data.get("Показатель падежа скота", 0) or 0)
    automation = int(farmer_data.get("Наличие автоматизации", 0) or 0)
    violations = int(farmer_data.get("История нарушений", 0) or 0)
    amount = float(farmer_data.get("Причитающая сумма", 0) or 0)
    efficiency = float(farmer_data.get("target_efficiency", 50) or 50)

    # ─── Layer 1: Rule-based (interpretable, legally defensible) ─────────────

    if growth > 0.5:
        report.flags.append(FraudFlag(
            code="BIO_GROWTH_EXCESSIVE", severity="HIGH",
            description_ru=f"Прирост {growth*100:.0f}% превышает биол. норму (макс. 50% без документов о закупке)",
            description_kz=f"Өсім {growth*100:.0f}% — биол. нормадан жоғары",
            rule_reference="Правила субсидирования, п. 15 — нормативы продуктивности"
        ))

    if growth > 0.2 and mortality > 0.1:
        report.flags.append(FraudFlag(
            code="BIO_CONTRADICTION_GROWTH_MORTALITY", severity="HIGH",
            description_ru=f"Прирост {growth*100:.0f}% + падёж {mortality*100:.0f}% — биологически несовместимо",
            description_kz=f"Өсім {growth*100:.0f}% + шығын {mortality*100:.0f}% — биол. қарама-қайшы",
            rule_reference="Ветнормы РК — допустимый падёж КРС ≤5%"
        ))

    if violations == 1 and amount > 10_000_000:
        report.flags.append(FraudFlag(
            code="RISK_VIOLATIONS_HIGH_AMOUNT", severity="MEDIUM",
            description_ru=f"Нарушения в истории + сумма {amount/1e6:.1f} млн ₸",
            description_kz=f"Бұзушылықтар + {amount/1e6:.1f} млн ₸ сомасы",
            rule_reference="Правила субсидирования, п. 8"
        ))

    if automation == 1 and efficiency < 20:
        report.flags.append(FraudFlag(
            code="FRAUD_AUTOMATION_MISMATCH", severity="MEDIUM",
            description_ru="Автоматизация заявлена, AI-эффективность критически низкая (<20)",
            description_kz="Автоматтандыру жарияланды, AI тиімділігі өте төмен",
            rule_reference="Правила субсидирования, п. 12"
        ))

    if growth <= 0 and amount > 5_000_000:
        report.flags.append(FraudFlag(
            code="RISK_ZERO_GROWTH_HIGH_SUBSIDY", severity="LOW",
            description_ru=f"Нулевой прирост + запрашивает {amount/1e6:.1f} млн ₸",
            description_kz=f"Нөл өсімімен {amount/1e6:.1f} млн ₸ сұрайды",
            rule_reference="Правила субсидирования, п. 6"
        ))

    # ─── Layer 2: Isolation Forest (ML — catches non-obvious patterns) ────────
    feature_vec = np.array([[growth, mortality, amount, automation, violations]])
    iso_score = float(_iso_forest.score_samples(feature_vec)[0])  # negative = more anomalous
    report.ml_anomaly_score = iso_score

    # score_samples returns negative values; threshold ~-0.15 flags anomalies
    if iso_score < -0.15 and not any(f.severity == "HIGH" for f in report.flags):
        report.flags.append(FraudFlag(
            code="ML_STATISTICAL_ANOMALY", severity="ML_ANOMALY",
            description_ru=f"Статистическая аномалия (Isolation Forest: {iso_score:.3f}) — профиль заявки нетипичен",
            description_kz=f"Статистикалық аномалия (Isolation Forest: {iso_score:.3f})",
            rule_reference="ML-антифрод: Isolation Forest (5% contamination threshold)"
        ))

    # ─── Final verdict ────────────────────────────────────────────────────────
    high = [f for f in report.flags if f.severity == "HIGH"]
    medium = [f for f in report.flags if f.severity == "MEDIUM"]
    ml_flags = [f for f in report.flags if f.severity == "ML_ANOMALY"]

    if high or len(medium) >= 2 or (ml_flags and medium):
        report.requires_field_inspection = True
        trigger = (high or medium or ml_flags)[0]
        report.inspection_reason_ru = trigger.description_ru
        report.inspection_reason_kz = trigger.description_kz

    return report
