import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema({
  // Categorical Fields
  Type_of_materials: { type: String },
  Sub_type_of_materials: { type: String },
  Functional_group_drug: { type: String },
  Abbreviation: { type: String },
  Shape: { type: String },
  Agglomeration: { type: String },
  Zeta_potential: { type: String },
  Cell_Type: { type: String },
  Stimulant: { type: String },
  Cellular_uptake: { type: String },
  Pro_inflammatory: { type: String },
  Anti_inflammatory: { type: String },
  Apoptosis: { type: String },
  Organism: { type: String },
  Gender: { type: String },
  Dose_times: { type: String },
  Administration_route: { type: String },
  Injury_Model: { type: String },
  Biosafety: { type: String },
  Recovery: { type: String },
  Reference: { type: String },

  // Numeric Range Fields (Scientific Ranges)
  Size_nm_min: { type: Number },
  Size_nm_max: { type: Number },
  NPs_Conc_ug_mL_min: { type: Number },
  NPs_Conc_ug_mL_max: { type: Number },
  Stimulant_Conc_ug_ml_min: { type: Number },
  Stimulant_Conc_ug_ml_max: { type: Number },
  Age_Weeks_min: { type: Number },
  Age_Weeks_max: { type: Number },
  Weight_g_min: { type: Number },
  Weight_g_max: { type: Number },
  Dose_invivo_mg_Kg_min: { type: Number },
  Dose_invivo_mg_Kg_max: { type: Number }
}, { 
  timestamps: true 
});

// Compound Text Index for Keyword Searching
materialSchema.index({
  Type_of_materials: 'text',
  Abbreviation: 'text',
  Reference: 'text',
  Injury_Model: 'text'
}, {
  weights: {
    Abbreviation: 10,
    Type_of_materials: 5,
    Injury_Model: 3,
    Reference: 1
  },
  name: 'MaterialTextIndex'
});

const Material = mongoose.model('Material', materialSchema);

export default Material;
