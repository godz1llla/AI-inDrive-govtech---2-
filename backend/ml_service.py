"""
ml_service.py — CatBoost ML Inference & SHAP Explainability Layer
=================================================================
Loads a pre-trained CatBoostRegressor model and provides:
  - predict()       : returns score [0-100] + SHAP top-3 feature contributions
  - Z-score heuristic for regional anomaly detection
Used by: backend/main.py (POST /analyze)
"""
import os
import joblib
import pandas as pd
import numpy as np
import shap
from catboost import CatBoostRegressor, Pool

class MLService:
    """Singleton wrapper around CatBoost model with SHAP explainability."""

    def __init__(self):
        self.model_path = os.path.join(os.path.dirname(__file__), "merit_model.cbm")
        self.model = None
        self.feature_names = None
        self.load_model()

    def load_model(self):
        if os.path.exists(self.model_path):
            self.model = CatBoostRegressor()
            self.model.load_model(self.model_path)
            self.feature_names = self.model.feature_names_
            print(f"Model loaded with {len(self.feature_names)} features.")
        else:
            print(f"Warning: Model not found at {self.model_path}")

    def predict(self, farmer_data: dict):
        if self.model is None:
            return {"score": 50, "explanation": "Model not loaded", "top_features": [], "is_anomaly": False, "is_elite": False, "z_score": 0, "risk_level": "Medium"}
            
        df = pd.DataFrame([farmer_data])
        
        # Explicitly define categorical features as strings
        cat_features = ['Область', 'Направление водства', 'Наименование субсидирования', 'Статус заявки', 'Район хозяйства']
        
        # Ensure all required features exist and are of correct type
        for f in self.feature_names:
            if f not in df.columns:
                df[f] = 0 if f not in cat_features else ""
        
        # Final type casting for CatBoost Pool
        cols_to_use = self.feature_names
        for col in cols_to_use:
            if col in cat_features:
                df[col] = df[col].astype(str).fillna("")
            else:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

        # Use Pool for prediction and SHAP
        pool = Pool(df[cols_to_use], cat_features=cat_features)
        
        pred = float(self.model.predict(pool)[0])
        score = max(0, min(100, pred))
        
        # SHAP Explainability
        explainer = shap.TreeExplainer(self.model)
        contributions = explainer.shap_values(pool)[0]
        
        # Sort and get top impact factors
        top_indices = np.argsort(np.abs(contributions))[::-1][:3]
        
        top_features = []
        for idx in top_indices:
            name = self.feature_names[idx]
            val = contributions[idx]
            raw_val = df.iloc[0][name]
            
            # Clarity mapping
            display_name = name
            if name == 'Наличие автоматизации':
                display_name = "Автоматизация" if str(raw_val) == '1' else "Отсутствие автоматизации"
            elif name == 'История нарушений':
                display_name = "История нарушений" if str(raw_val) == '1' else "Чистая история"
            elif name == 'Показатель падежа скота':
                display_name = "Низкий падеж" if float(raw_val) < 0.05 else "Высокий падеж"
                
            top_features.append({
                "feature": name,
                "contribution": float(val),
                "display": f"{display_name}: {'+' if val > 0 else ''}{val:.1f}%"
            })
            
        # Z-score Anomaly Detection (simplified for direct row context)
        # In a real app, this would use the regional_stats from prepare_ml_data.py
        # Here we use a heuristic or mock for demonstration based on the provided logic
        z_score = 0.0
        if score > 90: z_score = 1.6 # Potential high-performer
        if score < 15: z_score = 2.1 # Potential fraud/error
        
        risk_level = "Low"
        if score < 40: risk_level = "High"
        elif score < 60: risk_level = "Medium"
        elif score > 85: risk_level = "Elite"
        
        if z_score > 2: risk_level = "Anomalous"

        return {
            "score": score,
            "top_features": top_features,
            "is_anomaly": z_score > 2,
            "is_elite": score > 85,
            "z_score": z_score,
            "risk_level": risk_level
        }

ml_service = MLService()
