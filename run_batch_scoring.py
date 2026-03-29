import os
import pandas as pd
import numpy as np
import sys

# Add backend to path to import services
sys.path.append(os.path.join(os.getcwd(), "backend"))

try:
    from ml_service import ml_service
    from fraud_detector import detect_fraud
except ImportError as e:
    print(f"Error importing services: {e}")
    sys.exit(1)

DATA_PATH = "merit_scoring_dataset_33k.xlsx"
OUTPUT_PATH = "merit_scoring_final_audit.csv"

def main():
    print(f"Loading dataset: {DATA_PATH}...")
    df = pd.read_excel(DATA_PATH)
    df = df.loc[:, ~df.columns.str.contains('^Unnamed')].copy()
    
    total = len(df)
    print(f"Processing {total} applications. This may take a minute...")

    # Lists for new columns
    ai_scores = []
    anomaly_flags = []
    risk_levels = []
    archetypes = []

    # Process in batches or row by row (CatBoost is fast)
    for i, row in df.iterrows():
        data_dict = row.to_dict()
        
        # 1. ML Score
        # We use a simplified predict if possible to avoid SHAP overhead for 33k rows
        # But ml_service.predict is fine if we don't need SHAP here
        # Actually, let's call a minimal version or just predict
        if ml_service.model:
            # Skip SHAP for 33k rows to ensure high speed
            res = ml_service.predict(data_dict, skip_shap=True)
            score = res['score']
            archetype = res.get('archetype', 'Базовый профиль')
        else:
            score = 50.0
            archetype = 'Базовый профиль'
            
        # 2. Fraud Check
        fraud = detect_fraud(data_dict)
        
        ai_scores.append(round(score, 1))
        anomaly_flags.append(fraud.requires_field_inspection)
        risk_levels.append("High" if fraud.requires_field_inspection else ("Low" if score > 70 else "Medium"))
        archetypes.append(archetype)
        
        if (i + 1) % 5000 == 0:
            print(f"Processed {i + 1}/{total}...")

    # Add columns
    df['ai_score'] = ai_scores
    df['anomaly_flag'] = anomaly_flags
    df['risk_level'] = risk_levels
    df['archetype'] = archetypes

    # Sort by score DESC
    df = df.sort_values(by='ai_score', ascending=False)

    print(f"Saving results to {OUTPUT_PATH}...")
    df.to_csv(OUTPUT_PATH, index=False)
    print("Batch processing complete! 🚀")

if __name__ == "__main__":
    main()
