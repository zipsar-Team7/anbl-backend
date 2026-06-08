import json
import os
import math

# Paths
DATA_PATH = r"D:\Zipsar-Base\anbl-backend\data\webtool-2-data.json"
META_OUT = r"D:\Zipsar-Base\anbl-backend\models\polytox_metadata.json"

def generate_metadata():
    print("Reading dataset JSON...")
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Feature collection
    features = [
        'Synthesis_method', 'Polymer_type', 'Material_2',
        'Core_size_min', 'Shape', 'PDI_min', 
        'Hydrodynamic_size_water_min', 'Surface_charge_water_min'
    ]
    
    # Unique values for Categorical Encoding
    meta = {
        "Synthesis_method": sorted(list(set(d.get('Synthesis_method', 'Not reported') for d in data))),
        "Polymer_type": sorted(list(set(d.get('Polymer_type', 'Not reported') for d in data))),
        "Material_2": sorted(list(set(d.get('Material_2', 'Not reported') for d in data))),
        "Shape": sorted(list(set(d.get('Shape', 'Not reported') for d in data))),
        "classes": ["Severe Toxicity", "Moderate Toxicity", "Biosafe"],
        "base_viability": 78.5 # Mean viability from dataset
    }
    
    os.makedirs(os.path.dirname(META_OUT), exist_ok=True)
    with open(META_OUT, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2)
    
    print(f"Metadata generated successfully at {META_OUT}")
    print(f"Found {len(meta['Synthesis_method'])} Synthesis methods and {len(meta['Polymer_type'])} Polymer types.")

if __name__ == "__main__":
    generate_metadata()
