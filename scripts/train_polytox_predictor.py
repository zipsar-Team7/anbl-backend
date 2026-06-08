import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import pickle
import json
import os

# Configuration
DATA_PATH = r"D:\Zipsar-Base\anbl-backend\data\webtool-2-updated-data.xlsx"
MODEL_OUT = r"D:\Zipsar-Base\anbl-backend\models\polytox_xgboost.pkl"
META_OUT = r"D:\Zipsar-Base\anbl-backend\models\polytox_metadata.json"

def train_model():
    print("Loading dataset...")
    df = pd.read_excel(DATA_PATH)
    
    # Feature selection based on manuscript
    features = [
        'Synthesis method', 'Polymer type', 'Material_2',
        'Core size (nm)', 'Shape', 'PDl', 
        'Hydrodynamic size in water (nm)', 'Surface charge in water (mV)'
    ]
    
    # Target mapping (Viability % -> Class)
    # 0: Severe, 1: Moderate, 2: Biosafe
    def get_class(v):
        try:
            v = float(v)
            if v > 80: return 2
            if v > 50: return 1
            return 0
        except:
            return 2 # Default to safe if unreadable
            
    df['target'] = df['Viability (%)'].apply(get_class)
    
    X = df[features].copy()
    y = df['target']
    
    # Handle missing values
    for col in X.columns:
        if X[col].dtype == 'object':
            X[col] = X[col].fillna('Not reported')
        else:
            X[col] = X[col].fillna(X[col].median())
            
    # One-Hot Encoding
    X_encoded = pd.get_dummies(X)
    feature_names = X_encoded.columns.tolist()
    
    print(f"Training on {len(X_encoded)} samples with {len(feature_names)} encoded features.")
    
    X_train, X_test, y_train, y_test = train_test_split(X_encoded, y, test_size=0.2, random_state=42)
    
    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        objective='multi:softprob',
        num_class=3
    )
    
    model.fit(X_train, y_train)
    
    # Save Model
    os.makedirs(os.path.dirname(MODEL_OUT), exist_ok=True)
    with open(MODEL_OUT, 'wb') as f:
        pickle.dump(model, f)
        
    # Save Metadata (for One-Hot encoding in Node.js)
    metadata = {
        "features": features,
        "encoded_columns": feature_names,
        "classes": ["Severe Toxicity", "Moderate Toxicity", "Biosafe"]
    }
    with open(META_OUT, 'w') as f:
        json.dump(metadata, f, indent=2)
        
    print("Training complete. Model and Metadata saved.")
    
    # Print report
    preds = model.predict(X_test)
    print(classification_report(y_test, preds))

if __name__ == "__main__":
    train_model()
