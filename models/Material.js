import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema({
  Scale_Coverage: { type: String },
  Meta_Article_no: { type: Number },
  Meta_doi: { type: String },
  Meta_Title: { type: String },
  Meta_Scale: { type: String },
  MIE_P_M_Type: { type: String },
  MIE_P_Size_nm: { type: String },
  MIE_P_Shape: { type: String },
  MIE_P_Agglomeration: { type: String },
  MIE_P_Zeta_potential: { type: String },
  MIE_E_Cell_Type: { type: String },
  MIE_E_NPs_Conc_ug_mL: { type: String },
  MIE_E_Stimulant: { type: String },
  MIE_E_Stimulant_Conc_ug_ml: { type: String },
  MIE_E_C_uptake: { type: String },
  KE_Pro: { type: String },
  KE_Anti: { type: String },
  KE_Apoptosis: { type: String },
  MIE_E_Organism: { type: String },
  MIE_E_Sex: { type: String },
  MIE_E_Age_Weeks: { type: String },
  MIE_E_Weight_g: { type: String },
  MIE_E_NPs_Dose_mg_Kg: { type: String },
  MIE_E_Dose_Regimen: { type: String },
  MIE_E_Ad_route: { type: String },
  MIE_E_Injury_Model: { type: String },
  AO_Biosafety: { type: String },
  AO_Recovery: { type: String }
}, { 
  timestamps: true 
});

// Compound Text Index for Keyword Searching
materialSchema.index({
  Meta_Title: 'text',
  MIE_P_M_Type: 'text',
  MIE_E_Injury_Model: 'text',
  MIE_E_Cell_Type: 'text'
}, {
  weights: {
    Meta_Title: 10,
    MIE_P_M_Type: 5,
    MIE_E_Injury_Model: 3,
    MIE_E_Cell_Type: 1
  },
  name: 'MaterialTextIndex'
});

const Material = mongoose.model('Material', materialSchema);

export default Material;
