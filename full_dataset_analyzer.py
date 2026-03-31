"""
full_dataset_analyzer.py — Окончательный национальный реестр субсидий АПК РК (2025)
=====================================================================================
Запуск: python full_dataset_analyzer.py

Генерирует AGROSCORE_FINAL_AUDIT_2025.csv — главный артефакт системы:
- ai_score          : предсказанный балл эффективности (0–100, CatBoost)
- anomaly_score     : балл изоляции (Isolation Forest, < –0.15 = аномалия)
- anomaly_flag      : True/False
- regional_z_score  : отклонение от среднего по области (сигма)
- system_recommendation: ОДОБРИТЬ / ПРОВЕРИТЬ / ОТКАЗАТЬ
"""

import os
import sys
import time
import numpy as np
import pandas as pd
from catboost import CatBoostRegressor, Pool
from sklearn.ensemble import IsolationForest

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_PATH  = os.path.join(BASE_DIR, "merit_scoring_dataset_33k.xlsx")
MODEL_PATH = os.path.join(BASE_DIR, "backend", "catboost_model.cbm")
OUT_PATH   = os.path.join(BASE_DIR, "AGROSCORE_FINAL_AUDIT_2025.csv")

# ── Thresholds ────────────────────────────────────────────────────────────────
APPROVE_THRESHOLD  = 70.0   # ai_score >= this → ОДОБРИТЬ (if no anomaly)
REJECT_THRESHOLD   = 40.0   # ai_score <  this → ОТКАЗАТЬ
ANOMALY_THRESHOLD  = -0.15  # isolation forest score < this → аномалия
Z_ALERT_THRESHOLD  = 2.5    # regional z-score > this → ПРОВЕРИТЬ

# ── 1. Load dataset ──────────────────────────────────────────────────────────
print("[1/6] Загрузка датасета...")
t0 = time.time()
df = pd.read_excel(DATA_PATH)
df = df.loc[:, ~df.columns.str.contains('^Unnamed')].copy()
print(f"      {len(df):,} записей загружено за {time.time()-t0:.1f}с")

# ── 2. Load CatBoost model ───────────────────────────────────────────────────
print("[2/6] Загрузка модели CatBoost...")
model = CatBoostRegressor()
model.load_model(MODEL_PATH)
feature_names = model.feature_names_
cat_features  = ['Область', 'Направление водства', 'Наименование субсидирования',
                  'Статус заявки', 'Район хозяйства']
print(f"      Модель загружена: {len(feature_names)} признаков — {MODEL_PATH}")

# ── 3. CatBoost inference (batch) ────────────────────────────────────────────
print("[3/6] AI-скоринг по всему реестру (CatBoost)...")
t1 = time.time()

df_feat = df.copy()
for f in feature_names:
    if f not in df_feat.columns:
        df_feat[f] = 0 if f not in cat_features else ""

for col in feature_names:
    if col in cat_features:
        df_feat[col] = df_feat[col].astype(str).fillna("")
    else:
        df_feat[col] = pd.to_numeric(df_feat[col], errors='coerce').fillna(0)

pool = Pool(df_feat[feature_names], cat_features=cat_features)
raw_scores = model.predict(pool)
df['ai_score'] = np.clip(raw_scores, 0, 100).round(1)
print(f"      Завершено за {time.time()-t1:.1f}с — средний балл: {df['ai_score'].mean():.1f}")

# ── 4. Isolation Forest (anomaly detection) ──────────────────────────────────
print("[4/6] Обнаружение аномалий (Isolation Forest)...")
t2 = time.time()

numeric_cols = [c for c in feature_names if c not in cat_features]
X_iso = df_feat[numeric_cols].fillna(0).values

iso = IsolationForest(
    n_estimators=200,
    contamination=0.05,   # 5 % — гарантированно flagged as anomaly
    random_state=42,
    n_jobs=-1
)
iso.fit(X_iso)
anomaly_scores  = iso.score_samples(X_iso).round(4)
anomaly_labels  = iso.predict(X_iso)          # -1 = аномалия, 1 = норма
df['anomaly_score'] = anomaly_scores
df['anomaly_flag']  = (anomaly_labels == -1)  # use model's own decision boundary
n_anomalies = df['anomaly_flag'].sum()
print(f"      {n_anomalies:,} аномалий обнаружено ({n_anomalies/len(df)*100:.1f}%) за {time.time()-t2:.1f}с")

# ── 5. Regional Z-score ──────────────────────────────────────────────────────
print("[5/6] Расчет регионального Z-score...")
reg_mean = df.groupby('Область')['ai_score'].transform('mean')
reg_std  = df.groupby('Область')['ai_score'].transform('std').fillna(1)
df['regional_z_score'] = ((df['ai_score'] - reg_mean) / reg_std).round(2)

# ── 6. System Recommendation ─────────────────────────────────────────────────
print("[6/6] Присвоение системной рекомендации...")

def assign_recommendation(row):
    score = row['ai_score']
    flag  = row['anomaly_flag']
    z     = abs(row['regional_z_score'])

    if score < REJECT_THRESHOLD:
        return "ОТКАЗАТЬ"
    if flag or z > Z_ALERT_THRESHOLD:
        return "ПРОВЕРИТЬ"
    if score >= APPROVE_THRESHOLD:
        return "ОДОБРИТЬ"
    return "ПРОВЕРИТЬ"  # средняя зона [40, 70)

df['system_recommendation'] = df.apply(assign_recommendation, axis=1)

counts = df['system_recommendation'].value_counts()
for status, cnt in counts.items():
    print(f"      {status}: {cnt:,} ({cnt/len(df)*100:.1f}%)")

# ── 7. Clean & round ─────────────────────────────────────────────────────────
# Drop any all-None or Unnamed columns
df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
df = df.dropna(how='all')

# Round all float columns to 1 decimal
float_cols = df.select_dtypes(include='float64').columns.tolist()
for col in float_cols:
    if col in ('anomaly_score', 'regional_z_score'):
        continue  # keep 4 and 2 decimals respectively
    df[col] = df[col].round(1)

# ── 8. Save ──────────────────────────────────────────────────────────────────
df.to_csv(OUT_PATH, index=False, encoding='utf-8-sig')
size_mb = os.path.getsize(OUT_PATH) / 1_048_576
print(f"\n✅ Готово! Файл сохранён: {OUT_PATH}")
print(f"   Записей: {len(df):,} | Столбцов: {len(df.columns)} | Размер: {size_mb:.1f} МБ")
print(f"   Колонки: {', '.join(df.columns.tolist())}")
print(f"\nНациональный реестр сформирован. Каждая из {len(df):,} заявок получила ИИ-вердикт и сохранена в базу")
