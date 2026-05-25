import pandas as pd
import json
import math
import os
import re

file_path = r"d:\Zipsar-Base\anbl-backend\data\webtool-2-updated-data.xlsx"
out_path = r"C:\Users\rajiv\.gemini\antigravity-ide\scratch\webtolol-2-data.json"

def clean_categorical(val):
    if pd.isna(val) or val is None:
        return "Not reported"
    s = str(val).strip()
    if s == "" or s.lower() in ["nan", "unknown", "un known", "missing", "—", "-"]:
        return "Not reported"
    return s

def get_polymer_category(material_name):
    if material_name == "Not reported":
        return "Not reported"
    name_lower = material_name.lower()
    if "dendrimer" in name_lower or "dentrimer" in name_lower or "dgl" in name_lower or "pamam" in name_lower:
        return "Dendrimer"
    elif "liposome" in name_lower:
        return "Liposome"
    elif "micelle" in name_lower or "peg-pla" in name_lower or "peg-pcl" in name_lower or "mpeg-pcl" in name_lower or "mpeg-pla" in name_lower or "mpeg-plga" in name_lower or "pla-peg" in name_lower or "plga-peg" in name_lower or "pvp-b-pcl" in name_lower:
        return "Polymeric micelle"
    elif "hydrogel" in name_lower:
        return "Hydrogel"
    elif "hybrid" in name_lower:
        return "Hybrid"
    else:
        return "Polymeric nanoparticle"

def clean_synthesis_method(val):
    s = clean_categorical(val)
    if s == "Not reported":
        return s
    
    # Standardize common variations
    s_lower = s.lower().replace(" ", "").replace("-", "").replace("_", "")
    mapping = {
        "selfassembly": "Self-Assembly",
        "ionicgelationmethod": "Ionic Gelation Method",
        "ionotropicgelationmethod": "Ionotropic Gelation Method",
        "nanoprecipitation": "Nanoprecipitation",
        "emulsionsolventevaporation": "Emulsion Solvent Evaporation",
        "doubleemulsionsolventevaporation": "Double Emulsion Solvent Evaporation",
        "doubleemulsionsolventevaporationmethod": "Double Emulsion Solvent Evaporation Method",
        "solventevaporationmethod": "Solvent Evaporation Method"
    }
    return mapping.get(s_lower, s)

def clean_cell_type(val):
    s = clean_categorical(val)
    if s == "Not reported":
        return s
    
    s_lower = s.lower().replace(" ", "").replace("-", "").replace("_", "")
    if s_lower == "cancer":
        return "Cancer"
    elif s_lower in ["normal", "normalcell", "normalcells"]:
        return "Normal"
    elif s_lower in ["normalimmortalized", "normalimmortalised"]:
        return "Normal - Immortalized"
    return s

def parse_bounds(val):
    if pd.isna(val) or val is None:
        return None, None
    s = str(val).strip().replace(",", "")
    s_lower = s.lower()
    
    if s_lower in ["not reported", "unknown", "un known", "missing", "nan", "—", "-", "low", "high", "positive", "negative"]:
        return None, None
        
    # Check standard deviation "±" format (e.g., 8±3)
    if "±" in s:
        parts = s.split("±")
        try:
            mean = float(parts[0].strip())
            sd = float(parts[1].strip())
            return mean - sd, mean + sd
        except ValueError:
            pass
            
    # Check range "-" format (e.g., 50-200)
    if "-" in s:
        parts = s.split("-")
        try:
            low = float(parts[0].strip())
            high = float(parts[1].strip())
            return low, high
        except ValueError:
            pass
            
    # Try direct numeric parse
    try:
        num = float(s)
        return num, num
    except ValueError:
        return None, None

try:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Excel file not found at {file_path}")
        
    xl = pd.ExcelFile(file_path)
    df = pd.read_excel(file_path, sheet_name=xl.sheet_names[0])
    
    records = []
    for index, row in df.iterrows():
        # Get raw values
        raw_poly_type = clean_categorical(row.get("Polymer type"))
        raw_material_2 = clean_categorical(row.get("Material_2"))
        raw_synth = clean_synthesis_method(row.get("Synthesis method"))
        
        raw_core = clean_categorical(row.get("Core size (nm)"))
        raw_shape = clean_categorical(row.get("Shape"))
        raw_pdi = clean_categorical(row.get("PDl"))
        raw_hydro = clean_categorical(row.get("Hydrodynamic size in water (nm)"))
        raw_charge = clean_categorical(row.get("Surface charge in water (mV)"))
        
        # Standardize casings
        if raw_poly_type != "Not reported":
            # Clean compound name duplicates
            raw_poly_type = raw_poly_type.replace("Lipid- PLGA", "Lipid-PLGA").replace("Collagen Nps", "Collagen NPs")
            # Ensure it is properly capitalized
            if raw_poly_type.lower() == "chitosan":
                raw_poly_type = "Chitosan"
                
        # Dynamically categorize the polymer type
        raw_polymers = get_polymer_category(raw_poly_type)
                
        if raw_material_2 != "Not reported":
            raw_material_2 = raw_material_2.replace("AVP(4-5) peptide", "AVP (4-5) peptide")
            if raw_material_2.lower() == "rotigotine":
                raw_material_2 = "Rotigotine"
            elif raw_material_2.lower() == "curcumin":
                raw_material_2 = "Curcumin"
            elif raw_material_2.lower() == "peptide":
                raw_material_2 = "Peptide"
                
        if raw_shape != "Not reported":
            if raw_shape.lower() == "spherical":
                raw_shape = "Spherical"
                
        # Parse Min/Max Numeric Bounds
        core_min, core_max = parse_bounds(row.get("Core size (nm)"))
        pdi_min, pdi_max = parse_bounds(row.get("PDl"))
        hydro_min, hydro_max = parse_bounds(row.get("Hydrodynamic size in water (nm)"))
        charge_min, charge_max = parse_bounds(row.get("Surface charge in water (mV)"))
        
        # In vitro exposure
        media_type = clean_categorical(row.get("Media"))
        assay_type = clean_categorical(row.get("Assay"))
        cell_name = clean_categorical(row.get("Cell name"))
        cell_type = clean_cell_type(row.get("Cell type"))
        cell_type_detail = clean_categorical(row.get("Cell Type"))
        cell_origin = clean_categorical(row.get("Cell Type Origin"))
        
        exposure_dose = clean_categorical(row.get("Exposure dose (μg/mL)"))
        exposure_time_val = row.get("Exposure time (h)")
        exposure_time = float(exposure_time_val) if not pd.isna(exposure_time_val) else 0.0
        
        # Viability & Toxicity
        viab_val = clean_categorical(row.get("Viability (%)"))
        # Flag abnormal values
        if viab_val != "Not reported":
            try:
                num_viab = float(viab_val)
                if num_viab > 120.0:
                    viab_val = f"ANOMALY: {viab_val}"
            except ValueError:
                pass
                
        toxicity = clean_categorical(row.get("Toxicity"))
        if toxicity != "Not reported":
            if toxicity.lower() == "mild toxicity":
                toxicity = "Mild Toxicity"
                
        # Reference
        article = clean_categorical(row.get("Article Name"))
        pubmed_val = row.get("Pubmed ID")
        pubmed_id = int(pubmed_val) if not pd.isna(pubmed_val) and str(pubmed_val).strip() != "" else 0
        doi = clean_categorical(row.get("DOI"))
        
        record = {
            "Polymers": raw_polymers,
            "Polymer_type": raw_poly_type,
            "Material_2": raw_material_2,
            "Synthesis_method": raw_synth,
            
            "Core_size_nm": raw_core,
            "Core_size_min": core_min,
            "Core_size_max": core_max,
            
            "Shape": raw_shape,
            
            "PDI": raw_pdi,
            "PDI_min": pdi_min,
            "PDI_max": pdi_max,
            
            "Hydrodynamic_size_water_nm": raw_hydro,
            "Hydrodynamic_size_water_min": hydro_min,
            "Hydrodynamic_size_water_max": hydro_max,
            
            "Surface_charge_water_mV": raw_charge,
            "Surface_charge_water_min": charge_min,
            "Surface_charge_water_max": charge_max,
            
            "Media": media_type,
            "Assay": assay_type,
            "Cell_name": cell_name,
            "Cell_type": cell_type,
            "Cell_Type_Detail": cell_type_detail,
            "Cell_Type_Origin": cell_origin,
            
            "Exposure_dose_ug_mL": exposure_dose,
            "Exposure_time_h": exposure_time,
            
            "Viability_percent": viab_val,
            "Toxicity": toxicity,
            
            "Article_Name": article,
            "Pubmed_ID": pubmed_id,
            "DOI": doi
        }
        records.append(record)
        
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
    print(f"Success: Cleaned and exported {len(records)} PolyTox records to webtolol-2-data.json")
except Exception as e:
    print(f"Error: {e}")
