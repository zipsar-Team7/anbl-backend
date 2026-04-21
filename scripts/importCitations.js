import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import Citation from '../models/Citation.js';

dotenv.config();

const importData = async () => {
  try {
    await connectDB();

    const filePath = path.join(process.cwd(), 'data', 'citations.csv');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Split lines but handle potential newlines within quotes (rare in this dataset but good practice)
    const lines = fileContent.split(/\r?\n/);
    const headers = lines[0].split(',');
    
    const citations = [];

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

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = parseLine(lines[i]);
      
      if (values.length >= headers.length) {
        citations.push({
          authors: values[0],
          title: values[1],
          publication: values[2],
          volume: values[3],
          number: values[4],
          pages: values[5],
          year: values[6] ? parseInt(values[6]) : null,
          publisher: values[7]
        });
      }
    }

    // Clear existing data (optional, but good for re-running)
    await Citation.deleteMany();
    
    await Citation.insertMany(citations);

    console.log(`${citations.length} Citations Imported successfully!`);
    process.exit();
  } catch (error) {
    console.error(`Error with data import: ${error.message}`);
    process.exit(1);
  }
};

importData();
