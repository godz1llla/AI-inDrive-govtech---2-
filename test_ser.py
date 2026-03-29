import pandas as pd
import numpy as np
import json
import os

DATA_PATH = "merit_scoring_dataset_33k.xlsx"
if os.path.exists(DATA_PATH):
    df = pd.read_excel(DATA_PATH).head(100)
    print("Columns:", df.columns.tolist())
    records = df.to_dict(orient='records')
    try:
        json.dumps(records)
        print("Standard json.dumps: OK")
    except Exception as e:
        print(f"Standard json.dumps FAILED: {e}")
        
    # Test cleaning
    cleaned = df.where(pd.notnull(df), None).to_dict(orient='records')
    try:
        json.dumps(cleaned)
        print("Cleaned json.dumps: OK")
    except Exception as e:
        print(f"Cleaned json.dumps FAILED: {e}")
        
    # Check for Inf
    print("Inf values:", np.isinf(df.select_dtypes(include=np.number)).any().any())
else:
    print(f"File not found: {DATA_PATH}")
