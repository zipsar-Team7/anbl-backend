import pandas as pd
import json
import math

file_path = r"d:\Zipsar-Base\anbl-backend\data\webtool-1-updates-data.xlsx"
out_path = r"d:\Zipsar-Base\anbl-backend\data\webtool-1-data.json"

column_mapping = {
    'Scale_Coverage': 'Scale_Coverage',
    'Meta_Article no': 'Meta_Article_no',
    'Meta_doi': 'Meta_doi',
    'Meta_Title': 'Meta_Title',
    'Meta_Scale': 'Meta_Scale',
    'MIE-P_M_Type': 'MIE_P_M_Type',
    'MIE-P_Size_nm': 'MIE_P_Size_nm',
    'MIE-P_Shape': 'MIE_P_Shape',
    'MIE-P_Agglomeration': 'MIE_P_Agglomeration',
    'MIE-P_Zeta_potential': 'MIE_P_Zeta_potential',
    'MIE-E_Cell_Type': 'MIE_E_Cell_Type',
    'MIE-E_NPs_Conc (ug/mL)': 'MIE_E_NPs_Conc_ug_mL',
    'MIE-E_Stimulant': 'MIE_E_Stimulant',
    'MIE-E_Stimulant_Conc(ug/ml)': 'MIE_E_Stimulant_Conc_ug_ml',
    'MIE-E_C_uptake': 'MIE_E_C_uptake',
    'KE_Pro': 'KE_Pro',
    'KE_Anti': 'KE_Anti',
    'KE_Apoptosis': 'KE_Apoptosis',
    'MIE-E_Organism': 'MIE_E_Organism',
    'MIE-E_Sex': 'MIE_E_Sex',
    'MIE-E_Age_Weeks': 'MIE_E_Age_Weeks',
    'MIE-E_Weight_g': 'MIE_E_Weight_g',
    'MIE-E_NPs_Dose_ mg/Kg': 'MIE_E_NPs_Dose_mg_Kg',
    'MIE-E_Dose_Regimen': 'MIE_E_Dose_Regimen',
    'MIE-E_Ad_route': 'MIE_E_Ad_route',
    'MIE-E_Injury_Model': 'MIE_E_Injury_Model',
    'AO_Biosafety': 'AO_Biosafety',
    'AO_Recovery': 'AO_Recovery'
}

def clean_value(val):
    if pd.isna(val) or val is None:
        return "Missing"
    
    if isinstance(val, (int, float)):
        if math.isnan(val):
            return "Missing"
        return val
        
    s = str(val).strip()
    if s == "" or s.lower() == "nan" or s.lower() == "missing" or s.lower() == "missing ":
        return "Missing"
        
    # Standardize casing of common values
    s_lower = s.lower()
    standard_map = {
        "low": "Low",
        "high": "High",
        "good": "Good",
        "bad": "Bad",
        "both": "Both",
        "yes": "Yes",
        "no": "No",
        "male": "Male",
        "female": "Female",
        "negative": "Negative",
        "positive": "Positive",
        "organic": "Organic",
        "inorganic": "Inorganic",
        "hybrid": "Hybrid",
        "hydrogel": "Hydrogel",
        "other": "Other",
        "single": "Single",
        "multiple": "Multiple",
        "glial": "Glial",
        "neuronal": "Neuronal",
        "primary": "Primary",
        "macrophage": "Macrophage"
    }
    
    if s_lower in standard_map:
        return standard_map[s_lower]
        
    return s

try:
    df = pd.read_excel(file_path, sheet_name="Final_dataset")
    
    records = []
    for _, row in df.iterrows():
        record = {}
        for orig_col, new_col in column_mapping.items():
            if orig_col in row:
                val = row[orig_col]
                cleaned = clean_value(val)
                # Meta_Article_no should remain an int
                if new_col == 'Meta_Article_no':
                    if cleaned == "Missing":
                        cleaned = 0
                    else:
                        cleaned = int(float(cleaned))
                record[new_col] = cleaned
        records.append(record)
        
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
        
    print(f"Success: Cleaned and exported {len(records)} records to webtool-1-data.json")
except Exception as e:
    print(f"Error: {e}")
