import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import Material from '../models/Material.js';

dotenv.config();

const importMaterials = async () => {
  try {
    await connectDB();

    const filePath = path.join(process.cwd(), 'data', 'webtool-1-data.csv');
    if (!fs.existsSync(filePath)) {
      throw new Error(`CSV file not found at ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split(/\r?\n/);
    
    // Simple CSV parser for quoted strings
    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const materials = [];

    // Map CSV header names to Mongoose Schema field names
    const headerMapping = {
      "Type of materials": "Type_of_materials",
      "Sub_type of materials": "Sub_type_of_materials",
      "Functioal group/drug": "Functional_group_drug",
      "Abbreviation": "Abbreviation",
      "Shape": "Shape",
      "Agglomeration": "Agglomeration",
      "Zeta potential": "Zeta_potential",
      "Cell_Type": "Cell_Type",
      "Stimulant": "Stimulant",
      "Cellular uptake": "Cellular_uptake",
      "Pro_inflammatoary ": "Pro_inflammatory",
      "Anti_inflammatoary ": "Anti_inflammatory",
      "Apoptosis": "Apoptosis",
      "Organism": "Organism",
      "Gender": "Gender",
      "Dose times (Single dose/Multiple dose)": "Dose_times",
      "Administration route": "Administration_route",
      "Injury_Model": "Injury_Model",
      "Biosafety": "Biosafety",
      "Recovery": "Recovery",
      "Reference": "Reference",
      "Size (nm)_min": "Size_nm_min",
      "Size (nm)_max": "Size_nm_max",
      "NPs_Conc (ug/mL)_min": "NPs_Conc_ug_mL_min",
      "NPs_Conc (ug/mL)_max": "NPs_Conc_ug_mL_max",
      "Stimulant_Conc(ug/ml)_min": "Stimulant_Conc_ug_ml_min",
      "Stimulant_Conc(ug/ml)_max": "Stimulant_Conc_ug_ml_max",
      "Age (Weeks)_min": "Age_Weeks_min",
      "Age (Weeks)_max": "Age_Weeks_max",
      "Weight (g)_min": "Weight_g_min",
      "Weight (g)_max": "Weight_g_max",
      "Dose_invivo_ (mg/Kg)_min": "Dose_invivo_mg_Kg_min",
      "Dose_invivo_ (mg/Kg)_max": "Dose_invivo_mg_Kg_max"
    };

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = parseLine(lines[i]);
      const materialObj = {};
      
      headers.forEach((header, index) => {
        const fieldName = headerMapping[header];
        if (fieldName) {
          let value = values[index];
          
          // Handle numeric fields
          if (fieldName.endsWith('_min') || fieldName.endsWith('_max')) {
            value = value && !isNaN(value) ? parseFloat(value) : null;
          }
          
          materialObj[fieldName] = value;
        }
      });

      if (Object.keys(materialObj).length > 0) {
        materials.push(materialObj);
      }
    }

    // Clear existing data to avoid duplicates
    await Material.deleteMany();
    
    // Bulk insert for performance
    await Material.insertMany(materials);

    console.log(`Successfully imported ${materials.length} material records into MongoDB.`);
    process.exit(0);
  } catch (error) {
    console.error(`Import failed: ${error.message}`);
    process.exit(1);
  }
};

importMaterials();
