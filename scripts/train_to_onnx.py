import pandas as pd
import numpy as np
import xgboost as xgb
import json
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import onnxmltools
from onnxconverter_common.data_types import FloatTensorType

# --- CONFIGURATION ---
DATA_PATH = r"D:\Zipsar-Base\anbl-backend\data\webtool-2-data.json"
MODEL_DIR = r"D:\Zipsar-Base\anbl-backend\models"
ONNX_PATH = os.path.join(MODEL_DIR, "polytox_model.onnx")
META_PATH = os.path.join(MODEL_DIR, "polytox_metadata.json")

# Mapping your 9 Inputs to Dataset Columns
INPUT_MAPPING = {
    'synthesis': 'Synthesis_method',
    'polymers': 'Polymers',
    'polymer_type': 'Polymer_type',
    'functional_group': 'Material_2',
    'core_size': 'Core_size_min',
    'shape': 'Shape',
    'pdi': 'PDI_min',
    'hydro_size': 'Hydrodynamic_size_water_min',
    'charge': 'Surface_charge_water_min'
}

def train_and_export():
    print("🚀 Loading Dataset...")
    if not os.path.exists(DATA_PATH):
        print(f"❌ Error: Data file not found at {DATA_PATH}")
        return

    df = pd.read_json(DATA_PATH)
    
    # 1. Feature Selection
    features = list(INPUT_MAPPING.values())
    X = df[features].copy()
    
    # 2. Target Generation (Viability -> Class)
    def get_class(v):
        try:
            val = float(str(v).replace(',', ''))
            if val > 80: return 2 # Biosafe
            if val > 50: return 1 # Moderate
            return 0 # Severe
        except: return 2
    y = df['Viability_percent'].apply(get_class)

    # 3. Preprocessing (Handling missing & Categoricals)
    meta = {"encodings": {}, "medians": {}, "features": features}
    
    for col in features:
        # Fill missing
        if X[col].dtype == 'object':
            X[col] = X[col].fillna('Not reported').astype(str)
            # Label Encoding
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col])
            meta["encodings"][col] = {str(label): int(idx) for idx, label in enumerate(le.classes_)}
        else:
            X[col] = pd.to_numeric(X[col], errors='coerce')
            median_val = X[col].median()
            X[col] = X[col].fillna(median_val)
            meta["medians"][col] = float(median_val)

    print(f"📊 Training on {len(X)} samples...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.15, random_state=42)

    # 4. Train XGBoost
    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        objective='multi:softprob',
        num_class=3,
        use_label_encoder=False,
        eval_metric='mlogloss'
    )
    model.fit(X_train.values, y_train)

    # 5. Export to ONNX (The Binary Real Model)
    print("📦 Exporting to ONNX...")
    
    # Convert using onnxmltools for XGBoost
    onnx_model = onnxmltools.convert_xgboost(model, initial_types=[('input', FloatTensorType([None, len(features)]))])
    
    os.makedirs(MODEL_DIR, exist_ok=True)
    with open(ONNX_PATH, "wb") as f:
        f.write(onnx_model.SerializeToString())

    # 6. Save Metadata
    with open(META_PATH, 'w') as f:
        json.dump(meta, f, indent=2)

    print(f"✅ Success! Binary Model saved to: {ONNX_PATH}")
    print(f"✅ Metadata saved to: {META_PATH}")
    print("---")
    print("Next Step: I will refactor the backend once you finish.")

if __name__ == "__main__":
    try:
        train_and_export()
    except ImportError as e:
        print(f"❌ Error: Missing libraries. Please run: pip install pandas xgboost onnxmltools skl2onnx onnxconverter-common")
    except Exception as e:
        print(f"❌ Error: {e}")
