import pandas as pd
import numpy as np
import os

# Set seed for reproducibility
np.random.seed(42)

def generate_dataset(source_file, output_file, row_count=33000):
    print(f"Loading {source_file}...")
    df_source = pd.read_excel(source_file, header=4)
    df_source = df_source.dropna(subset=['№ п/п'])
    
    print(f"Sampling {row_count} rows...")
    df = df_source.sample(n=row_count, replace=True if len(df_source) < row_count else False).reset_index(drop=True)
    
    print("Generating Professional Merit Dataset 2.0...")
    
    # 1. Base Features
    df['growth_rate'] = np.random.normal(0.12, 0.18, row_count).clip(-0.2, 0.6)
    df['mortality_rate'] = np.random.normal(0.015, 0.04, row_count).clip(0, 0.12)
    df['has_automation'] = np.random.choice([0, 1], size=row_count, p=[0.65, 0.35])
    df['violation_history'] = np.random.choice([0, 1], size=row_count, p=[0.96, 0.04])
    
    # Identify Regions and Subsidy Types for non-linear interactions
    regions = df['Область'].unique()
    subsidies = df['Наименование субсидирования'].unique()
    
    # Create regional/subsidy multipliers (Non-linear hidden logic)
    reg_mult = {r: np.random.uniform(0.8, 1.2) for r in regions}
    sub_mult = {s: np.random.uniform(0.7, 1.3) for s in subsidies}
    
    print("Calculating non-linear target_efficiency...")
    
    def calculate_efficiency(row):
        # Base efficiency starts at 50
        eff = 50.0
        
        # Linear components
        eff += row['growth_rate'] * 35 # Increased weight for growth
        eff -= row['mortality_rate'] * 60 # Increased penalty for mortality
        eff -= row['violation_history'] * 25 # Heavier penalty for violations
        
        # Corrected Logic: Automation MUST be positive
        # Base bonus for having automation
        if row['has_automation'] == 1:
            automation_bonus = 15.0
            # 5% chance of "technical failure" or "inefficiency" despite automation
            if np.random.random() < 0.05:
                automation_bonus = -2.0
            
            eff += automation_bonus
            # Synergetic effect: growth is more valuable with automation
            eff += (row['growth_rate'] * 45) 
        else:
            eff -= 8.0 # Penalty for lack of modern infrastructure
            
        # Regional and Subsidy type modifiers
        eff *= reg_mult.get(row['Область'], 1.0)
        eff *= sub_mult.get(row['Наименование субсидирования'], 1.0)
        
        # Interaction between Automation and Specific Subsidies
        # (e.g., Breeding benefits more from automation)
        if "племен" in str(row['Наименование субсидирования']).lower() and row['has_automation'] == 1:
            eff += 12.0
            
        return np.clip(eff + np.random.normal(0, 4), 0, 100)

    df['target_efficiency'] = df.apply(calculate_efficiency, axis=1)
    
    # Rename columns to clear Russian names for final export
    df_export = df.copy()
    df_export.rename(columns={
        'growth_rate': 'Процент роста продукции',
        'mortality_rate': 'Показатель падежа скота',
        'has_automation': 'Наличие автоматизации',
        'violation_history': 'История нарушений'
    }, inplace=True)
    
    print(f"Saving to {output_file}...")
    df_export.to_excel(output_file, index=False)
    print("Generation Complete.")

if __name__ == "__main__":
    src = "Выгрузка по выданным субсидиям 2025 год (обезлич).xlsx"
    out = "merit_scoring_dataset_33k.xlsx"
    generate_dataset(src, out)
