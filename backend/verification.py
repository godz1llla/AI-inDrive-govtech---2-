"""
GovSystem Verification Module
Emulates ИСЖ/ИБСПР/КГИ field-level verification with specific comparison details.
"""

from dataclasses import dataclass, field
from typing import List, Literal

VerificationStatus = Literal["VERIFIED", "MISMATCH"]

@dataclass
class FieldVerification:
    field: str
    label_ru: str
    label_kz: str
    status: VerificationStatus
    source: str
    detail_ru: str = ""   # specific comparison detail shown in UI
    detail_kz: str = ""
    note: str = ""

@dataclass
class VerificationReport:
    fields: List[FieldVerification] = field(default_factory=list)
    overall_verified: bool = True
    mismatch_count: int = 0

    def to_dict(self):
        return {
            "fields": [
                {
                    "field": f.field,
                    "label_ru": f.label_ru,
                    "label_kz": f.label_kz,
                    "status": f.status,
                    "source": f.source,
                    "detail_ru": f.detail_ru,
                    "detail_kz": f.detail_kz,
                    "note": f.note
                }
                for f in self.fields
            ],
            "overall_verified": self.overall_verified,
            "mismatch_count": self.mismatch_count,
        }


def verify_application(farmer_data: dict) -> VerificationReport:
    report = VerificationReport()

    region = farmer_data.get("Область", "—")
    district = farmer_data.get("Район хозяйства", "—")
    automation = int(farmer_data.get("Наличие автоматизации", 0) or 0)
    violations = int(farmer_data.get("История нарушений", 0) or 0)
    amount = float(farmer_data.get("Причитающая сумма", 0) or 0)
    efficiency = float(farmer_data.get("target_efficiency", 50) or 50)
    growth = float(farmer_data.get("Процент роста продукции", 0) or 0)

    # ── 1. Geographic Registration (ИБСПР) ──────────────────────────────────
    report.fields.append(FieldVerification(
        field="Область",
        label_ru="Регион хозяйства",
        label_kz="Шаруашылық аймағы",
        status="VERIFIED",
        source="ИБСПР",
        detail_ru=f"В реестре ИБСПР: {region}, {district} — совпадает",
        detail_kz=f"ИБСПР тізілімінде: {region}, {district} — сәйкес келеді"
    ))

    # ── 2. Automation / Equipment Registry (ИСЖ) ────────────────────────────
    if automation == 1 and efficiency < 30:
        status = "MISMATCH"
        detail_ru = f"Заявлена автоматизация, но AI-эффективность {efficiency:.0f}/100 — ниже нормы"
        detail_kz = f"Автоматтандыру жарияланды, бірақ AI тиімділігі {efficiency:.0f}/100 — нормадан төмен"
        note = "Расхождение: автоматизация не подтверждается показателями продуктивности"
    else:
        status = "VERIFIED"
        auto_text = "зарегистрирована в реестре техники ИСЖ" if automation == 1 else "не заявлена (соответствует записям ИСЖ)"
        detail_ru = f"Автоматизация {auto_text}"
        detail_kz = f"Автоматтандыру: {'ИСЖ техника тізілімінде тіркелген' if automation == 1 else 'жарияланбаған (ИСЖ жазбаларымен сәйкес)'}"
        note = ""
    report.fields.append(FieldVerification(
        field="Наличие автоматизации",
        label_ru="Техника / автоматизация",
        label_kz="Техника / автоматтандыру",
        status=status, source="ИСЖ",
        detail_ru=detail_ru, detail_kz=detail_kz, note=note
    ))

    # ── 3. Violation History (КГИ) ────────────────────────────────────────────
    if violations == 1:
        status = "MISMATCH"
        detail_ru = "КГИ: найдены записи о нарушениях в предыдущих периодах"
        detail_kz = "МТИ: алдыңғы кезеңдердегі бұзушылықтар туралы жазбалар табылды"
        note = "Нарушения зафиксированы государственной инспекцией"
    else:
        status = "VERIFIED"
        detail_ru = "КГИ: нарушений не зафиксировано — чистая история"
        detail_kz = "МТИ: бұзушылықтар тіркелмеген — таза тарих"
        note = ""
    report.fields.append(FieldVerification(
        field="История нарушений",
        label_ru="История нарушений",
        label_kz="Бұзушылықтар тарихы",
        status=status, source="КГИ",
        detail_ru=detail_ru, detail_kz=detail_kz, note=note
    ))

    # ── 4. Subsidy Amount Validity (ИБСПР) ────────────────────────────────────
    regional_limit = 50_000_000
    if amount > regional_limit:
        status = "MISMATCH"
        detail_ru = f"Заявлено {amount/1e6:.1f} млн ₸ — превышает региональный норматив ИБСПР ({regional_limit/1e6:.0f} млн ₸)"
        detail_kz = f"Сұралды {amount/1e6:.1f} млн ₸ — ИБСПР өңір нормативінен ({regional_limit/1e6:.0f} млн ₸) асады"
        note = f"Превышение: {(amount - regional_limit)/1e6:.1f} млн ₸ сверх лимита"
    else:
        status = "VERIFIED"
        detail_ru = f"Сумма {amount/1e6:.1f} млн ₸ — в пределах регионального норматива ИБСПР ({regional_limit/1e6:.0f} млн ₸)"
        detail_kz = f"Сома {amount/1e6:.1f} млн ₸ — ИБСПР өңір нормативі шегінде"
        note = ""
    report.fields.append(FieldVerification(
        field="Причитающая сумма",
        label_ru="Сумма субсидии",
        label_kz="Субсидия сомасы",
        status=status, source="ИБСПР",
        detail_ru=detail_ru, detail_kz=detail_kz, note=note
    ))

    mismatches = [f for f in report.fields if f.status == "MISMATCH"]
    report.mismatch_count = len(mismatches)
    report.overall_verified = len(mismatches) == 0
    return report
