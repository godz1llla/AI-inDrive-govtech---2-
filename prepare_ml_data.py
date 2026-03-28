import pandas as pd
import numpy as np
from catboost import CatBoostRegressor, Pool
from sklearn.model_selection import KFold
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import json

def train_professional_model():
    print("Loading merit_scoring_dataset_33k.xlsx...")
    df = pd.read_excel('merit_scoring_dataset_33k.xlsx')
    
    # Define features
    categorical_features = ['Область', 'Район хозяйства', 'Направление водства', 'Наименование субсидирования', 'Статус заявки']
    numerical_features = ['Причитающая сумма', 'Процент роста продукции', 'Показатель падежа скота', 'Наличие автоматизации', 'История нарушений']
    
    X = df[categorical_features + numerical_features].copy()
    y = df['target_efficiency']
    
    # Handle NaNs in categorical features
    print("Handling NaNs in categorical features...")
    X[categorical_features] = X[categorical_features].fillna("Не указано").astype(str)
    # These will be used by the backend service
    print("Calculating regional/subsidy statistics for Z-score logic...")
    stats = {}
    
    for group_col in ['Область', 'Наименование субсидирования']:
        stats[group_col] = {}
        grouped = df.groupby(group_col)['Процент роста продукции']
        means = grouped.mean().to_dict()
        stds = grouped.std().to_dict()
        
        for key in means:
            stats[group_col][str(key)] = {
                'mean': float(means[key]),
                'std': float(stds[key]) if not np.isnan(stds[key]) else 0.01
            }
            
    with open('backend/regional_stats.json', 'w', encoding='utf-8') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    
    # K-Fold Cross Validation
    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    scores_r2 = []
    scores_mae = []
    
    print(f"Starting 5-Fold Cross Validation for CatBoost...")
    
    for i, (train_index, test_index) in enumerate(kf.split(X)):
        X_train, X_test = X.iloc[train_index], X.iloc[test_index]
        y_train, y_test = y.iloc[train_index], y.iloc[test_index]
        
        model = CatBoostRegressor(
            iterations=500,
            learning_rate=0.1,
            depth=6,
            loss_function='MAE',
            cat_features=categorical_features,
            verbose=False,
            random_seed=42
        )
        
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        
        r2 = r2_score(y_test, y_pred)
        mae = mean_absolute_error(y_test, y_pred)
        
        scores_r2.append(r2)
        scores_mae.append(mae)
        print(f"  Fold {i+1}: R2={r2:.4f}, MAE={mae:.4f}")
        
    print(f"\nModel Stability Metrics:")
    print(f"  Mean R2: {np.mean(scores_r2):.4f} (+/- {np.std(scores_r2):.4f})")
    print(f"  Mean MAE: {np.mean(scores_mae):.4f} (+/- {np.std(scores_mae):.4f})")
    
    # Train final model on entire dataset
    print("\nTraining final model on full dataset...")
    final_model = CatBoostRegressor(
        iterations=500,
        learning_rate=0.1,
        depth=6,
        loss_function='MAE',
        cat_features=categorical_features,
        verbose=False,
        random_seed=42
    )
    final_model.fit(X, y)
    
    # Save model
    final_model.save_model('backend/merit_model.cbm')
    print("Final model saved to backend/merit_model.cbm")
    
if __name__ == "__main__":
    import os
    if not os.path.exists('backend'):
        os.makedirs('backend')
    train_professional_model()
