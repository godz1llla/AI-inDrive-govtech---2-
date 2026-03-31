"""
ml_service.py — CatBoost ML Inference & SHAP Explainability Layer (Agro-GovTech Version)
=====================================================================================
Customized for Breeding Livestock (Племенное Животноводство)
"""
import os
import pandas as pd
import numpy as np
import shap
from catboost import CatBoostRegressor, Pool

class MLService:
    """Singleton wrapper around CatBoost model with Agro-specific Radar & Archetypes."""

    def __init__(self):
        self.model_path = os.path.join(os.path.dirname(__file__), "catboost_model.cbm")
        self.model = None
        self.feature_names = None
        self.explainer = None
        self.load_model()

    def load_model(self):
        if os.path.exists(self.model_path):
            self.model = CatBoostRegressor()
            self.model.load_model(self.model_path)
            self.feature_names = self.model.feature_names_
            self.explainer = shap.TreeExplainer(self.model)
            print(f"Model and Explainer loaded with {len(self.feature_names)} features.")
        else:
            print(f"Warning: Model not found at {self.model_path}")

    def predict(self, farmer_data: dict, skip_shap: bool = False):
        if self.model is None:
            return {"score": 50, "explanation": "Model not loaded", "top_features": []}
            
        df = pd.DataFrame([farmer_data])
        cat_features = ['Область', 'Направление водства', 'Наименование субсидирования', 'Статус заявки', 'Район хозяйства']
        
        for f in self.feature_names:
            if f not in df.columns:
                df[f] = 0 if f not in cat_features else ""
        
        cols_to_use = self.feature_names
        for col in cols_to_use:
            if col in cat_features:
                df[col] = df[col].astype(str).fillna("")
            else:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

        pool = Pool(df[cols_to_use], cat_features=cat_features)
        pred = float(self.model.predict(pool)[0])
        score = max(0, min(100, pred))
        
        top_features = []
        if not skip_shap and self.explainer:
            contributions = self.explainer.shap_values(pool)[0]
            top_indices = np.argsort(np.abs(contributions))[::-1][:3]
            
            for idx in top_indices:
                name = self.feature_names[idx]
                val = contributions[idx]
                top_features.append({
                    "feature": name,
                    "contribution": float(val),
                    "display": f"{name}: {'+' if val > 0 else ''}{val:.1f}%"
                })
            
        z_score = 1.6 if score > 90 else (2.1 if score < 15 else 0.0)
        risk_level = "Low" if score > 70 else ("High" if score < 40 else "Medium")
        if z_score > 2: risk_level = "Anomalous"

        # --- GOVTECH RADAR METRICS ---
        productivity = score
        preservation = max(0, min(100, (1 - float(df.iloc[0].get('Показатель падежа скота', 0))) * 100))
        technology = 100 if str(df.iloc[0].get('Наличие автоматизации', 0)) == '1' else 20
        legal = 100 if str(df.iloc[0].get('История нарушений', 1)) == '0' else 30
        region_sync = 85 if str(df.iloc[0].get('Область', '')) != '' else 50
        
        radar_data = [
            {"subject": "Продуктивность", "value": productivity},
            {"subject": "Сохранность стада", "value": preservation},
            {"subject": "Технологичность", "value": technology},
            {"subject": "Юридическая история", "value": legal},
            {"subject": "Региональное соответствие", "value": region_sync},
        ]
        
        # --- AGRO ARCHETYPES (Dynamic by Score) ---
        if score >= 85:
            archetype = "ЛОКОМОТИВ РЕГИОНА"
        elif score >= 40:
            archetype = "БАЗОВЫЙ ПРОФИЛЬ"
        else:
            archetype = "ГРУППА РИСКА"

        return {
            "score": score,
            "top_features": top_features,
            "is_anomaly": z_score > 2,
            "risk_level": risk_level,
            "radar_data": radar_data,
            "archetype": archetype
        }

ml_service = MLService()
