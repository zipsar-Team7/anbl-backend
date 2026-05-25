import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import PolyToxMaterial from '../models/PolyToxMaterial.js';
import { execSync } from 'child_process';

dotenv.config();

const importPolyToxMaterials = async () => {
  try {
    await connectDB();

    console.log("Running Python script to parse and clean Excel file...");
    try {
      execSync('python scripts/xlsx_to_json_2.py', { stdio: 'inherit' });
    } catch (pythonErr) {
      throw new Error(`Python Excel parsing script failed: ${pythonErr.message}`);
    }

    const filePath = 'C:\\Users\\rajiv\\.gemini\\antigravity-ide\\scratch\\webtolol-2-data.json';
    if (!fs.existsSync(filePath)) {
      throw new Error(`Cleaned JSON file not found at ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const materials = JSON.parse(fileContent);

    if (!Array.isArray(materials) || materials.length === 0) {
      throw new Error("No material records parsed from Excel.");
    }

    // Clear existing data to avoid duplicates
    console.log("Clearing old PolyTox materials from database...");
    await PolyToxMaterial.deleteMany();
    
    // Bulk insert for performance
    console.log(`Inserting ${materials.length} new PolyTox materials...`);
    await PolyToxMaterial.insertMany(materials);

    console.log(`Successfully imported ${materials.length} PolyTox material records into MongoDB.`);
    process.exit(0);
  } catch (error) {
    console.error(`Import failed: ${error.message}`);
    process.exit(1);
  }
};

importPolyToxMaterials();
