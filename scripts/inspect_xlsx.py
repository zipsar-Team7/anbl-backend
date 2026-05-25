import pandas as pd
import json

file_path = r"d:\Zipsar-Base\anbl-backend\data\webtool-1-updates-data.xlsx"
out_path = r"d:\Zipsar-Base\anbl-backend\data\inspect_output.json"

try:
    df = pd.read_excel(file_path, sheet_name="Final_dataset")
    
    summary = {}
    summary["shape"] = df.shape
    summary["columns"] = []
    
    for col in df.columns:
        non_null = df[col].dropna()
        samples = non_null.head(10).tolist()
        unique_count = df[col].nunique()
        unique_samples = non_null.unique()[:10].tolist()
        
        # convert values to serializable types
        samples = [str(x) if not isinstance(x, (int, float)) else x for x in samples]
        unique_samples = [str(x) if not isinstance(x, (int, float)) else x for x in unique_samples]
        
        summary["columns"].append({
            "name": col,
            "dtype": str(df[col].dtype),
            "null_count": int(df[col].isna().sum()),
            "unique_count": unique_count,
            "samples": samples,
            "unique_samples": unique_samples
        })
        
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)
    print("Inspection completed successfully. Output written to inspect_output.json")
except Exception as e:
    print("Error:", e)
