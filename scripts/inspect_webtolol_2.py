import pandas as pd
import json
import os
import re

file_path = r"d:\Zipsar-Base\anbl-backend\data\webtool-2-updated-data.xlsx"
out_path = r"d:\Zipsar-Base\anbl-backend\data\inspect_webtolol_2.json"

def analyze_numeric_column(series):
    total = len(series)
    null_count = int(series.isna().sum())
    
    numeric_count = 0
    range_count = 0
    not_reported_count = 0
    other_text_count = 0
    samples_other = []
    min_val = float('inf')
    max_val = float('-inf')
    
    for val in series.dropna():
        s = str(val).strip()
        s_lower = s.lower()
        
        # Check if Not reported / Unknown
        if s_lower in ["not reported", "unknown", "un known", "missing", "nan", "—", "-"]:
            not_reported_count += 1
            continue
            
        # Try numeric direct parse
        try:
            # Clean commas if any
            num_str = s.replace(",", "")
            num = float(num_str)
            numeric_count += 1
            min_val = min(min_val, num)
            max_val = max(max_val, num)
            continue
        except ValueError:
            pass
            
        # Try range match (e.g. 50-200)
        range_match = re.match(r'^([\d\.]+)\s*-\s*([\d\.]+)$', s)
        if range_match:
            range_count += 1
            low = float(range_match.group(1))
            high = float(range_match.group(2))
            min_val = min(min_val, low)
            max_val = max(max_val, high)
            continue
            
        # Other text
        other_text_count += 1
        if len(samples_other) < 5:
            samples_other.append(s)
            
    return {
        "total": total,
        "null_count": null_count,
        "not_reported_or_unknown_count": not_reported_count,
        "clean_numeric_count": numeric_count,
        "range_format_count": range_count,
        "non_standard_text_count": other_text_count,
        "samples_non_standard": samples_other,
        "observed_min": min_val if min_val != float('inf') else None,
        "observed_max": max_val if max_val != float('-inf') else None
    }

try:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Excel file not found at {file_path}")
        
    xl = pd.ExcelFile(file_path)
    sheet_name = xl.sheet_names[0]
    df = pd.read_excel(file_path, sheet_name=sheet_name)
    
    bottlenecks = {}
    
    # 1. Inspect target filter numeric fields
    numeric_fields = [
        "Core size (nm)", "PDl", "Hydrodynamic size in water (nm)", 
        "Surface charge in water (mV)", "Exposure dose (μg/mL)", "Viability (%)"
    ]
    
    bottlenecks["numeric_analysis"] = {}
    for field in numeric_fields:
        if field in df.columns:
            bottlenecks["numeric_analysis"][field] = analyze_numeric_column(df[field])
            
    # 2. Inspect categorical columns for casing or format duplicates
    categorical_fields = [
        "Polymer type", "Material_2", "Synthesis method", "Shape", "Media", "Assay", "Cell type", "Toxicity"
    ]
    
    bottlenecks["categorical_inconsistencies"] = {}
    for field in categorical_fields:
        if field in df.columns:
            vals = df[field].dropna().unique()
            cleaned_map = {}
            for v in vals:
                s = str(v).strip()
                s_lower = s.lower().replace(" ", "").replace("-", "").replace("_", "")
                if s_lower not in cleaned_map:
                    cleaned_map[s_lower] = []
                cleaned_map[s_lower].append(s)
                
            duplicates = {k: v for k, v in cleaned_map.items() if len(v) > 1}
            if duplicates:
                bottlenecks["categorical_inconsistencies"][field] = duplicates
                
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(bottlenecks, f, indent=2)
    print("SUCCESS: Bottleneck inspection finished.")
except Exception as e:
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump({"error": str(e)}, f, indent=2)
    print("ERROR:", e)
