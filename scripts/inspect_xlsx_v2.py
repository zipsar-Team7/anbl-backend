import pandas as pd
import sys
import json

def inspect_xlsx(file_path):
    try:
        df = pd.read_excel(file_path)
        info = {
            "columns": df.columns.tolist(),
            "shape": df.shape,
            "head": df.head(5).to_dict(orient='records'),
            "unique_counts": df.nunique().to_dict()
        }
        print(json.dumps(info, indent=2))
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        inspect_xlsx(sys.argv[1])
    else:
        print("Usage: python inspect_xlsx_v2.py <file_path>")
