import mongoose from 'mongoose';

const polyToxMaterialSchema = new mongoose.Schema({
  Polymers: { type: String, default: 'Polymers' },
  Polymer_type: { type: String, required: true }, // The material (Chitosan, PLGA, etc.)
  Material_2: { type: String }, // Functional group / drug
  Synthesis_method: { type: String },
  Core_size_nm: { type: String }, // Raw core size string (e.g. "50-200")
  Core_size_min: { type: Number }, // Calculated minimum numeric value
  Core_size_max: { type: Number }, // Calculated maximum numeric value
  Shape: { type: String },
  PDI: { type: String }, // Raw PDI string (e.g. "0.25")
  PDI_min: { type: Number },
  PDI_max: { type: Number },
  Hydrodynamic_size_water_nm: { type: String }, // Raw hydrodynamic size string
  Hydrodynamic_size_water_min: { type: Number },
  Hydrodynamic_size_water_max: { type: Number },
  Surface_charge_water_mV: { type: String }, // Raw surface charge string
  Surface_charge_water_min: { type: Number },
  Surface_charge_water_max: { type: Number },
  Media: { type: String },
  Assay: { type: String },
  Cell_type: { type: String },
  Cell_name: { type: String },
  Cell_Type_Detail: { type: String }, // From "Cell Type" column
  Cell_Type_Origin: { type: String },
  Exposure_dose_ug_mL: { type: String },
  Exposure_time_h: { type: Number },
  Viability_percent: { type: String }, // From "Viability (%)" column
  Toxicity: { type: String },
  Article_Name: { type: String },
  Pubmed_ID: { type: Number },
  DOI: { type: String }
}, {
  timestamps: true
});

// Text index for searching by materials, functional groups, and articles
polyToxMaterialSchema.index({
  Polymer_type: 'text',
  Material_2: 'text',
  Article_Name: 'text'
}, {
  weights: {
    Polymer_type: 10,
    Material_2: 5,
    Article_Name: 2
  },
  name: 'PolyToxMaterialTextIndex'
});

const PolyToxMaterial = mongoose.model('PolyToxMaterial', polyToxMaterialSchema);

export default PolyToxMaterial;
