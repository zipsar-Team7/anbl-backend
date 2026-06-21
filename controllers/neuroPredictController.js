import * as ort from 'onnxruntime-node';
import fs from 'fs';
import path from 'path';

// Resolve directory paths
const BASE_DIR = path.resolve();
const NEURO_DIR = path.join(BASE_DIR, 'model_assets', 'neuro');
const REC_MODEL = path.join(NEURO_DIR, 'recovery', 'model.onnx');
const REC_META = path.join(NEURO_DIR, 'recovery', 'meta.json');
const TOX_MODEL = path.join(NEURO_DIR, 'toxicity', 'model.onnx');
const TOX_META = path.join(NEURO_DIR, 'toxicity', 'meta.json');

// Auto-copy utility to migrate model assets from model workspace on server startup
function ensureModelAssetsExist() {
  const sourceBase = 'd:\\Zipsar-Base\\anbl-model\\model-neuro-bio-axis\\models';
  const targets = [
    { sub: 'recovery', file: 'model.onnx', dest: REC_MODEL },
    { sub: 'recovery', file: 'meta.json', dest: REC_META },
    { sub: 'toxicity', file: 'model.onnx', dest: TOX_MODEL },
    { sub: 'toxicity', file: 'meta.json', dest: TOX_META }
  ];

  for (const item of targets) {
    if (!fs.existsSync(item.dest)) {
      const srcPath = path.join(sourceBase, item.sub, item.file);
      if (fs.existsSync(srcPath)) {
        console.log(`[AUTO-COPY] Copying missing model asset: ${srcPath} -> ${item.dest}`);
        fs.mkdirSync(path.dirname(item.dest), { recursive: true });
        fs.copyFileSync(srcPath, item.dest);
      } else {
        console.warn(`[AUTO-COPY] Warning: Source model asset not found at ${srcPath}`);
      }
    }
  }
}

// Copy assets if missing
ensureModelAssetsExist();

let recSession = null;
let toxSession = null;
let recMeta = null;
let toxMeta = null;

// Read metadata
try {
  if (fs.existsSync(REC_META)) {
    recMeta = JSON.parse(fs.readFileSync(REC_META, 'utf8'));
  }
  if (fs.existsSync(TOX_META)) {
    toxMeta = JSON.parse(fs.readFileSync(TOX_META, 'utf8'));
  }
} catch (e) {
  console.error("❌ Failed to parse Neuro-Bio-Axis model metadata:", e.message);
}

// Expected 21 input features in exact configuration order
const inputColumns = [
  "MIE-P_M_Type",
  "MIE-P_Size_nm",
  "MIE-P_Shape",
  "MIE-P_Agglomeration",
  "MIE-P_Zeta_potential",
  
  "MIE-E_Cell_Type",
  "MIE-E_NPs_Conc (ug/mL)",
  "MIE-E_Stimulant",
  "MIE-E_Stimulant_Conc(ug/ml)",
  "MIE-E_C_uptake",
  "MIE-E_Organism",
  "MIE-E_Sex",
  "MIE-E_Age_Weeks",
  "MIE-E_Weight_g",
  "MIE-E_NPs_Dose_ mg/Kg",
  "MIE-E_Dose_Regimen",
  "MIE-E_Ad_route",
  "MIE-E_Injury_Model",
  
  "KE_Pro",
  "KE_Anti",
  "KE_Apoptosis"
];

// Mapping frontend request keys to metadata JSON feature names
const requestMapping = {
  'MIE_P_M_Type': 'MIE-P_M_Type',
  'MIE_P_Size_nm': 'MIE-P_Size_nm',
  'MIE_P_Shape': 'MIE-P_Shape',
  'MIE_P_Agglomeration': 'MIE-P_Agglomeration',
  'MIE_P_Zeta_potential': 'MIE-P_Zeta_potential',
  
  'MIE_E_Cell_Type': 'MIE-E_Cell_Type',
  'MIE_E_NPs_Conc': 'MIE-E_NPs_Conc (ug/mL)',
  'MIE_E_Stimulant': 'MIE-E_Stimulant',
  'MIE_E_Stimulant_Conc': 'MIE-E_Stimulant_Conc(ug/ml)',
  'MIE_E_C_uptake': 'MIE-E_C_uptake',
  'MIE_E_Organism': 'MIE-E_Organism',
  'MIE_E_Sex': 'MIE-E_Sex',
  'MIE_E_Age_Weeks': 'MIE-E_Age_Weeks',
  'MIE_E_Weight_g': 'MIE-E_Weight_g',
  'MIE_E_NPs_Dose': 'MIE-E_NPs_Dose_ mg/Kg',
  'MIE_E_Dose_Regimen': 'MIE-E_Dose_Regimen',
  'MIE_E_Ad_route': 'MIE-E_Ad_route',
  'MIE_E_Injury_Model': 'MIE-E_Injury_Model',
  
  'KE_Pro': 'KE_Pro',
  'KE_Anti': 'KE_Anti',
  'KE_Apoptosis': 'KE_Apoptosis'
};

// Lazy initialization of ONNX Inference Sessions
async function getSessions() {
  if (!recSession) {
    if (!fs.existsSync(REC_MODEL)) {
      throw new Error(`Recovery model not found at ${REC_MODEL}`);
    }
    console.log('🚀 Loading Neuro Recovery ONNX Session...');
    recSession = await ort.InferenceSession.create(REC_MODEL);
  }
  if (!toxSession) {
    if (!fs.existsSync(TOX_MODEL)) {
      throw new Error(`Toxicity model not found at ${TOX_MODEL}`);
    }
    console.log('🚀 Loading Neuro Toxicity ONNX Session...');
    toxSession = await ort.InferenceSession.create(TOX_MODEL);
  }
  return { recSession, toxSession };
}

// Transform input payload into ONNX expected Tensors
function prepareOnnxInputs(session, inputs, numericCols) {
  const expectedInputs = session.inputNames;
  const feeds = {};

  for (const col of inputColumns) {
    // skl2onnx C-variable name sanitization rule (replace non-alphanumeric with underscore)
    const sanitizedCol = col.replace(/[^a-zA-Z0-9_]/g, '_');
    
    if (!expectedInputs.includes(sanitizedCol)) {
      continue;
    }

    // Match request key
    const reqKey = Object.keys(requestMapping).find(k => requestMapping[k] === col);
    const rawVal = inputs[reqKey];

    if (numericCols.includes(col)) {
      let val = NaN;
      if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== "") {
        val = parseFloat(rawVal);
      }
      feeds[sanitizedCol] = new ort.Tensor('float32', Float32Array.from([isNaN(val) ? 0.0 : val]), [1, 1]);
    } else {
      const val = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : 'missing';
      feeds[sanitizedCol] = new ort.Tensor('string', [val], [1, 1]);
    }
  }
  return feeds;
}

/**
 * Controller to predict Recovery and Biosafety/Toxicity simultaneously
 * POST /api/neuro/predict
 */
export const predictNeuro = async (req, res, next) => {
  try {
    const inputs = req.body;

    if (!recMeta || !toxMeta) {
      // Re-try parsing in case copy was just completed
      if (fs.existsSync(REC_META)) recMeta = JSON.parse(fs.readFileSync(REC_META, 'utf8'));
      if (fs.existsSync(TOX_META)) toxMeta = JSON.parse(fs.readFileSync(TOX_META, 'utf8'));
      
      if (!recMeta || !toxMeta) {
        return res.status(500).json({
          status: 'error',
          message: 'Neuro-Bio-Axis Model metadata is not loaded on the server.'
        });
      }
    }

    // Get active inference sessions
    const sessions = await getSessions();

    // 1. Recovery Prediction
    const recFeeds = prepareOnnxInputs(sessions.recSession, inputs, recMeta.numeric_cols);
    const recResults = await sessions.recSession.run(recFeeds);
    const recClassIdx = Number(recResults[sessions.recSession.outputNames[0]].data[0]);
    const recProbs = Array.from(recResults[sessions.recSession.outputNames[1]].data);
    const recLabel = recMeta.classes[recClassIdx];
    const recConf = recProbs[recClassIdx];

    // 2. Toxicity Prediction
    const toxFeeds = prepareOnnxInputs(sessions.toxSession, inputs, toxMeta.numeric_cols);
    const toxResults = await sessions.toxSession.run(toxFeeds);
    const toxClassIdx = Number(toxResults[sessions.toxSession.outputNames[0]].data[0]);
    const toxProbs = Array.from(toxResults[sessions.toxSession.outputNames[1]].data);
    const toxLabel = toxMeta.classes[toxClassIdx];
    const toxConf = toxProbs[toxClassIdx];

    return res.status(200).json({
      status: 'success',
      data: {
        recovery: {
          prediction: recLabel,
          confidence: parseFloat(recConf.toFixed(4))
        },
        toxicity: {
          prediction: toxLabel,
          confidence: parseFloat(toxConf.toFixed(4))
        }
      }
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Controller to generate nanoparticle neuro-formulation optimization recommendations.
 * Utilizes the Gemini 2.5 Flash API with a rule-based fallback engine.
 * POST /api/neuro/suggest
 */
export const suggestNeuroOptimization = async (req, res, next) => {
  try {
    const { inputs, recoveryPrediction, toxicityPrediction, recoveryConfidence, toxicityConfidence } = req.body;

    if (!inputs || !recoveryPrediction || !toxicityPrediction) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: inputs, recoveryPrediction, and toxicityPrediction are required.'
      });
    }

    // If both targets are Good (Safe and high recovery), no optimizations are needed
    if (toxicityPrediction.toLowerCase() === 'good' && recoveryPrediction.toLowerCase() === 'good') {
      return res.status(200).json({
        status: 'success',
        data: {
          explanation: 'The nanoparticle formulation is predicted to be biosafe and support therapeutic recovery. No optimization is needed.',
          tweaks: [],
          generalTips: ['Maintain synthesis conditions to keep stability.'],
          engine: 'static'
        }
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && apiKey !== 'your_gemini_api_key_here' && apiKey.trim() !== '') {
      try {
        console.log('🤖 Querying Gemini Flash API for Neuro optimization suggestions...');
        const prompt = `
You are an expert Nanomaterials Neuro-Toxicologist and Drug Delivery Formulation Scientist.
A nanoparticle configuration has been evaluated with dual-target predictive outcomes:
- Biosafety/Toxicity: ${toxicityPrediction} (Confidence: ${(toxicityConfidence * 100).toFixed(1)}%)
- Therapeutic Recovery: ${recoveryPrediction} (Confidence: ${(recoveryConfidence * 100).toFixed(1)}%)

Current Nanoparticle Configuration:
- Material Type: ${inputs.MIE_P_M_Type || 'Unknown'}
- Core Size: ${inputs.MIE_P_Size_nm || 'Unknown'} nm
- Shape: ${inputs.MIE_P_Shape || 'Unknown'}
- Agglomeration: ${inputs.MIE_P_Agglomeration || 'Unknown'}
- Zeta Potential: ${inputs.MIE_P_Zeta_potential || 'Unknown'}
- Cell Type: ${inputs.MIE_E_Cell_Type || 'Unknown'}
- NPs Concentration: ${inputs.MIE_E_NPs_Conc || 'Unknown'} ug/mL
- Stimulant: ${inputs.MIE_E_Stimulant || 'Unknown'}
- Stimulant Concentration: ${inputs.MIE_E_Stimulant_Conc || 'Unknown'} ug/mL
- Cellular Uptake: ${inputs.MIE_E_C_uptake || 'Unknown'}
- Organism: ${inputs.MIE_E_Organism || 'Unknown'}
- Admin Route: ${inputs.MIE_E_Ad_route || 'Unknown'}
- Injury Model: ${inputs.MIE_E_Injury_Model || 'Unknown'}
- Pro-inflammatory level: ${inputs.KE_Pro || 'Unknown'}
- Anti-inflammatory level: ${inputs.KE_Anti || 'Unknown'}
- Apoptosis level: ${inputs.KE_Apoptosis || 'Unknown'}

Identify parameters triggering toxicity (like high cationic zeta charge or high concentrations) or causing poor recovery.
Suggest at most 3 key parameter tweaks to make this configuration safe and recovery-supporting ("Good").
Be extremely brief. Keep the explanation under 2 sentences and each tweak reason under 15 words.
Return a JSON object conforming EXACTLY to this schema:
{
  "explanation": "Scientific reasoning explaining why the nanoparticle triggers toxicity or fails to promote recovery (max 2 sentences).",
  "tweaks": [
    {
      "parameter": "Exact Parameter Name (e.g. Zeta Potential, Core Size, NPs Concentration, Stimulant Concentration)",
      "currentValue": "Current Value",
      "recommendedValue": "Recommended Value or Range (scientifically reasonable)",
      "reason": "Scientific justification (max 15 words)"
    }
  ],
  "generalTips": ["Formulation tip 1", "Formulation tip 2"]
}
`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json",
              maxOutputTokens: 600,
              temperature: 0.2
            }
          })
        });

        if (!response.ok) {
          throw new Error(`Gemini API returned status code ${response.status}`);
        }

        const resultJson = await response.json();
        const responseText = resultJson.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (responseText) {
          const suggestions = JSON.parse(responseText.trim());
          return res.status(200).json({
            status: 'success',
            data: {
              ...suggestions,
              engine: 'gemini'
            }
          });
        }
      } catch (geminiError) {
        console.error('⚠️ Gemini API error occurred for Neuro, falling back to rule-based engine:', geminiError.message);
      }
    }

    // --- RULE-BASED FALLBACK ENGINE ---
    console.log('🛡️ Invoking rule-based fallback suggestion engine for Neuro...');
    let explanation = 'All formulation parameters are optimized. The nanoparticle exhibits good biosafety and therapeutic recovery potential.';
    if (toxicityPrediction === 'Bad' && recoveryPrediction === 'Bad') {
      explanation = 'The formulation is predicted to trigger high toxicity responses while showing poor recovery. This is primarily caused by cationic zeta potential, size mismatch, or excessive concentration.';
    } else if (toxicityPrediction === 'Bad') {
      explanation = 'The nanoparticle configuration is predicted to trigger hazard/toxicity responses. Adjusting surface charge, core size, or concentration is recommended.';
    } else if (recoveryPrediction === 'Bad') {
      explanation = 'The formulation is predicted to have poor neural recovery outcomes. Consider using targeted cell stimulants, or modifying the polymer matrix to improve neural interface integration.';
    }

    const tweaks = [];
    const generalTips = [
      'Evaluate nanoparticle hemocompatibility and adsorption of brain-specific serum proteins.',
      'Always verify blood-brain barrier (BBB) crossing efficiency using co-culture in vitro models.',
      'Synthesize nanomaterials under controlled nitrogen atmospheric environments to prevent polymer oxidation.'
    ];

    // 1. Check Zeta Potential
    if (inputs.MIE_P_Zeta_potential === 'Positive') {
      tweaks.push({
        parameter: 'Zeta Potential',
        currentValue: 'Positive',
        recommendedValue: 'Negative or Neutral',
        reason: 'Cationic surfaces cause severe electrostatic cell membrane disruption in glial cells.'
      });
    }

    // 2. Check Core Size
    const size = Number(inputs.MIE_P_Size_nm);
    if (!isNaN(size) && size > 0) {
      if (size < 50) {
        tweaks.push({
          parameter: 'Core Size',
          currentValue: `${size} nm`,
          recommendedValue: '80 nm to 150 nm',
          reason: 'Ultrasmall particles (< 50 nm) cause intracellular damage and cross nuclear envelopes.'
        });
      } else if (size > 250) {
        tweaks.push({
          parameter: 'Core Size',
          currentValue: `${size} nm`,
          recommendedValue: '80 nm to 150 nm',
          reason: 'Nanoparticles larger than 250 nm precipitate quickly and trigger macro-phagocytosis.'
        });
      }
    }

    // 3. Check NPs Concentration
    const conc = Number(inputs.MIE_E_NPs_Conc);
    if (!isNaN(conc) && conc > 150) {
      tweaks.push({
        parameter: 'NPs Concentration',
        currentValue: `${conc} ug/mL`,
        recommendedValue: '20 ug/mL to 80 ug/mL',
        reason: 'Concentrations exceeding 150 ug/mL lead to cytotoxic overload in astrocytes.'
      });
    }

    // 4. Check Stimulant Concentration
    const stimConc = Number(inputs.MIE_E_Stimulant_Conc);
    if (!isNaN(stimConc) && stimConc > 100) {
      tweaks.push({
        parameter: 'Stimulant Concentration',
        currentValue: `${stimConc} ug/mL`,
        recommendedValue: '< 50 ug/mL',
        reason: 'High stimulant concentrations trigger excessive inflammatory cytokine cascades.'
      });
    }

    // Default tweak if list is empty but prediction is bad
    if (tweaks.length === 0 && (toxicityPrediction === 'Bad' || recoveryPrediction === 'Bad')) {
      tweaks.push({
        parameter: 'Cellular Uptake',
        currentValue: inputs.MIE_E_C_uptake || 'Unknown',
        recommendedValue: 'Low (Controlled)',
        reason: 'Control cellular internalization rates via PEGylation to reduce cellular stress.'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        explanation,
        tweaks,
        generalTips,
        engine: 'fallback'
      }
    });
  } catch (err) {
    next(err);
  }
};
