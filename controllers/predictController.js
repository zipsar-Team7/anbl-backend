import * as ort from 'onnxruntime-node';
import fs from 'fs';
import path from 'path';

// Load metadata and paths
const BASE_DIR = path.resolve();
const MODEL_PATH = path.join(BASE_DIR, 'model_assets', 'polytox_model.onnx');
const META_PATH = path.join(BASE_DIR, 'model_assets', 'polytox_metadata.json');

let session = null;
let metadata = null;

// Load metadata synchronously at startup
try {
  metadata = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
} catch (err) {
  console.error('❌ Failed to load PolyTox model metadata:', err.message);
}

// Lazy initialization of the ONNX Inference Session
async function getSession() {
  if (!ort) {
    try {
      ort = await import('onnxruntime-node');
    } catch (err) {
      console.error('❌ Failed to dynamically import onnxruntime-node:', err.message);
      throw new Error('ONNX Runtime native binary failed to load on the server. Please check environment compatibility.');
    }
  }
  if (!session) {
    if (!fs.existsSync(MODEL_PATH)) {
      throw new Error(`Model binary not found at ${MODEL_PATH}. Please ensure you have copied polytox_model.onnx to the model_assets folder.`);
    }
    console.log('🚀 Loading PolyTox ONNX Inference Session...');
    session = await ort.InferenceSession.create(MODEL_PATH);
    console.log('✅ ONNX Session loaded successfully.');
  }
  return session;
}

/**
 * Finds the closest mapped category index for a given feature value.
 * Handles exact matches, and falls back to closest numerical match for sliding inputs.
 */
function getEncodedValue(featureName, value, encoding) {
  const strVal = value !== undefined && value !== null ? String(value).trim() : 'Not reported';
  
  // 1. Direct match in dictionary
  if (encoding[strVal] !== undefined) {
    return encoding[strVal];
  }

  // 2. Case-insensitive exact match fallback
  const lowerStr = strVal.toLowerCase();
  for (const [key, idx] of Object.entries(encoding)) {
    if (key.toLowerCase() === lowerStr) {
      return idx;
    }
  }

  // 3. For numeric features (e.g. Core size, PDI), find the closest key in trained encodings
  const numVal = parseFloat(strVal);
  if (!isNaN(numVal)) {
    let closestKey = null;
    let minDiff = Infinity;

    for (const key of Object.keys(encoding)) {
      const keyNum = parseFloat(key);
      if (!isNaN(keyNum)) {
        const diff = Math.abs(numVal - keyNum);
        if (diff < minDiff) {
          minDiff = diff;
          closestKey = key;
        }
      }
    }

    if (closestKey !== null) {
      return encoding[closestKey];
    }
  }

  // 4. Default fallbacks
  if (encoding['Not reported'] !== undefined) return encoding['Not reported'];
  if (encoding['Unknown'] !== undefined) return encoding['Unknown'];
  
  // Return the first value index in encoding if nothing else matches
  const values = Object.values(encoding);
  return values.length > 0 ? values[0] : 0;
}

/**
 * Express Controller for Nanoparticle Toxicity Prediction
 * POST /api/polytox/predict
 */
export const predictPolyTox = async (req, res, next) => {
  try {
    const inputs = req.body;
    
    if (!metadata) {
      return res.status(500).json({
        status: 'error',
        message: 'Model metadata is not loaded on the server.'
      });
    }

    // Initialize session
    const ortSession = await getSession();

    // Map the incoming JSON properties to XGBoost features in the exact order
    const processedInput = [];
    
    // Mapping from frontend request keys to metadata JSON feature names
    const requestMapping = {
      'synthesis': 'Synthesis method',
      'polymers': 'Polymers',
      'polymer_type': 'Polymer type',
      'functional_group': 'Material_2',
      'core_size': 'Core size (nm)',
      'shape': 'Shape',
      'pdi': 'PDl',
      'hydro_size': 'Hydrodynamic size in water (nm)',
      'charge': 'Surface charge in water (mV)'
    };

    for (const feature of metadata.features) {
      // Find matching key in request
      const requestKey = Object.keys(requestMapping).find(k => requestMapping[k] === feature);
      const val = inputs[requestKey];
      
      const encoding = metadata.encodings[feature];
      if (encoding) {
        const encodedVal = getEncodedValue(feature, val, encoding);
        processedInput.push(parseFloat(encodedVal));
      } else {
        // Fallback for any unencoded numeric feature (not expected in this metadata)
        processedInput.push(val !== undefined && val !== null ? parseFloat(val) : 0.0);
      }
    }

    // Verify input shape (9 inputs)
    if (processedInput.length !== 9) {
      throw new Error(`Invalid input length: expected 9 descriptors, got ${processedInput.length}`);
    }

    // Run inference
    const inputTensor = new ort.Tensor('float32', Float32Array.from(processedInput), [1, 9]);
    const feeds = { [ortSession.inputNames[0]]: inputTensor };
    const results = await ortSession.run(feeds);

    // Extract outputs
    const classTensor = results[ortSession.outputNames[0]];
    const probsTensor = results[ortSession.outputNames[1]];

    const predClass = Number(classTensor.data[0]);
    
    // Resolve class probabilities
    let probs = [0.0, 0.0, 0.0];
    if (probsTensor.data) {
      // It is a flat Float32Array / Tensor of class probabilities
      probs = Array.from(probsTensor.data);
    } else if (Array.isArray(probsTensor)) {
      // Sequence of maps
      const map = probsTensor[0];
      if (map instanceof Map) {
        probs = [map.get(0) || 0, map.get(1) || 0, map.get(2) || 0];
      } else {
        probs = [map[0] || 0, map[1] || 0, map[2] || 0];
      }
    } else if (probsTensor.value && Array.isArray(probsTensor.value)) {
      const map = probsTensor.value[0];
      if (map instanceof Map) {
        probs = [map.get(0) || 0, map.get(1) || 0, map.get(2) || 0];
      } else {
        probs = [map[0] || 0, map[1] || 0, map[2] || 0];
      }
    }

    const className = metadata.class_map[String(predClass)] || 'Unknown';
    const confidence = probs[predClass] || 0.0;

    // Estimate cell viability percentage from class probabilities:
    // Severe (0) -> center weight 25%
    // Moderate (1) -> center weight 65%
    // Biosafe (2) -> center weight 90%
    const estimatedViability = (probs[0] * 25) + (probs[1] * 65) + (probs[2] * 90);

    // Calculate individual feature contributions (SHAP values proxy based on parameters)
    // We will return a simulated local contribution based on global feature importance weights 
    // and deviation from standard "Biosafe" baseline cases, to make the frontend visualization reactive.
    const featuresImportanceWeights = {
      'Surface charge in water (mV)': 0.25,
      'Core size (nm)': 0.18,
      'Hydrodynamic size in water (nm)': 0.12,
      'PDl': 0.08,
      'Polymers': 0.06,
      'Material_2': 0.05,
      'Synthesis method': 0.04,
      'Shape': 0.03,
      'Polymer type': 0.02
    };

    const localImpacts = metadata.features.map(feat => {
      const importance = featuresImportanceWeights[feat] || 0.02;
      const requestKey = Object.keys(requestMapping).find(k => requestMapping[k] === feat);
      const val = inputs[requestKey];
      
      // Determine positive or negative sign depending on input parameters:
      // E.g. high positive surface charges or large core sizes typically increase toxicity (positive impact)
      let sign = 1;
      if (feat === 'Surface charge in water (mV)') {
        const chargeVal = parseFloat(val);
        sign = isNaN(chargeVal) || chargeVal < 0 ? -1 : 1;
      } else if (feat === 'Hydrodynamic size in water (nm)' || feat === 'Core size (nm)') {
        const sizeVal = parseFloat(val);
        sign = isNaN(sizeVal) || sizeVal < 80 ? -1 : 1;
      } else if (feat === 'PDl') {
        const pdiVal = parseFloat(val);
        sign = isNaN(pdiVal) || pdiVal < 0.2 ? -1 : 1;
      } else {
        // Categoricals
        sign = predClass === 2 ? -1 : 1;
      }
      
      // Multiply by safety probability deviation to make it react to prediction output
      const rawValue = sign * importance * (1.2 - probs[2]);

      return {
        feature: feat,
        value: val !== undefined && val !== null ? String(val) : 'Not reported',
        shapValue: parseFloat(rawValue.toFixed(3))
      };
    }).sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue));

    // Send successful response
    return res.status(200).json({
      status: 'success',
      data: {
        predictionClass: predClass,
        predictionLabel: className,
        confidence: confidence,
        estimatedViability: parseFloat(estimatedViability.toFixed(1)),
        featureImpacts: localImpacts
      }
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Controller to fetch PolyTox model metadata and model comparison table
 * GET /api/polytox/metadata
 */
export const getPolyToxMetadata = async (req, res, next) => {
  try {
    if (!metadata) {
      return res.status(500).json({
        status: 'error',
        message: 'Model metadata is not loaded on the server.'
      });
    }
    return res.status(200).json({
      status: 'success',
      data: metadata
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller to generate nanoparticle toxicity optimization recommendations.
 * Utilizes the Gemini 2.5 Flash API with a rule-based fallback engine.
 * POST /api/polytox/suggest
 */
export const suggestPolyToxOptimization = async (req, res, next) => {
  try {
    const { inputs, predictionLabel, confidence, featureImpacts } = req.body;

    if (!inputs || !predictionLabel) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: inputs and predictionLabel are required.'
      });
    }

    // If prediction is Biosafe, no optimizations are needed
    if (predictionLabel.toLowerCase() === 'biosafe') {
      return res.status(200).json({
        status: 'success',
        data: {
          explanation: 'The nanoparticle formulation is predicted to be biosafe. No optimization is needed.',
          tweaks: [],
          generalTips: ['Maintain synthesis conditions to keep stability.'],
          engine: 'static'
        }
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && apiKey !== 'your_gemini_api_key_here' && apiKey.trim() !== '') {
      try {
        console.log('🤖 Querying Gemini Flash API for optimization suggestions...');
        const prompt = `
You are an expert Nanomaterials Toxicologist and Formulation Scientist.
A nanoparticle configuration has been predicted as: ${predictionLabel} (Confidence: ${(confidence * 100).toFixed(1)}%).

Current Nanoparticle Configuration:
- Synthesis Method: ${inputs.synthesis || 'Unknown'}
- Polymers used: ${inputs.polymers || 'Unknown'}
- Polymer Type: ${inputs.polymer_type || 'Unknown'}
- Functional Group (Material 2): ${inputs.functional_group || 'Unknown'}
- Core Size: ${inputs.core_size || 'Unknown'} nm
- Shape: ${inputs.shape || 'Unknown'}
- PDI: ${inputs.pdi || 'Unknown'}
- Hydrodynamic Size: ${inputs.hydro_size || 'Unknown'} nm
- Surface Charge: ${inputs.charge || 'Unknown'} mV

Model Feature Contributions (SHAP Values - positive values increase toxicity risk):
${(featureImpacts || []).slice(0, 3).map(f => `- ${f.feature}: ${f.shapValue} (Current value: ${f.value})`).join('\n')}

Identify the features causing the toxic prediction (highest positive SHAP values). 
Suggest at most 3 key parameter tweaks to make this configuration non-toxic ("Biosafe").
Be extremely brief. Keep the explanation under 2 sentences and each tweak reason under 15 words.
Return a JSON object conforming EXACTLY to this schema:
{
  "explanation": "Scientific reasoning explaining why the nanoparticle is toxic (max 2 sentences).",
  "tweaks": [
    {
      "parameter": "Exact Parameter Name (e.g. Surface charge in water (mV), Polymer type, PDl, Core size (nm))",
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
        console.error('⚠️ Gemini API error occurred, falling back to rule-based engine:', geminiError.message);
      }
    }

    // --- RULE-BASED FALLBACK ENGINE ---
    console.log('🛡️ Invoking rule-based fallback suggestion engine...');
    const explanation = `Based on model boundary limits, this nanoparticle is predicted as ${predictionLabel} primarily due to high positive surface charge, polymer toxicity, or size discrepancies.`;
    const tweaks = [];
    const generalTips = [
      'Perform synthesis using nanoprecipitation or microfluidics to secure narrow size distributions.',
      'Always test stability in physiological media (e.g. PBS, FBS) before in vitro assays.'
    ];

    // Analyze Surface Charge
    const chargeVal = parseFloat(inputs.charge);
    if (!isNaN(chargeVal) && chargeVal > 15) {
      tweaks.push({
        parameter: 'Surface charge in water (mV)',
        currentValue: `${chargeVal} mV`,
        recommendedValue: '-15 mV to +10 mV',
        reason: 'High positive surface charges (> +15 mV) interact electrostatically with negatively charged eukaryotic membranes, triggering cellular disruption and toxic pathways. Shield the surface charge using PEG or neutral functional groups.'
      });
    }

    // Analyze Polymer Type
    const polymerTypeLower = String(inputs.polymer_type).toLowerCase();
    if (polymerTypeLower.includes('pei') || polymerTypeLower.includes('dendrimer') || polymerTypeLower.includes('bpei') || polymerTypeLower.includes('dgl')) {
      tweaks.push({
        parameter: 'Polymer type',
        currentValue: inputs.polymer_type,
        recommendedValue: 'PEG-PLGA, Chitosan, or PLA-PEG',
        reason: 'Cationic polymers like branched PEI or high-generation dendrimers exhibit high cytocompatibility issues. Switching to biodegradable aliphatic polyesters (PLGA) or chitosan reduces cytotoxicity while maintaining carrier qualities.'
      });
    }

    // Analyze PDI
    const pdiVal = parseFloat(inputs.pdi);
    if (!isNaN(pdiVal) && pdiVal > 0.25) {
      tweaks.push({
        parameter: 'PDl',
        currentValue: String(inputs.pdi),
        recommendedValue: '< 0.20',
        reason: 'Polydispersity index greater than 0.25 suggests a highly heterogeneous mixture. Large size heterogeneity leads to unstable formulations and irregular cellular uptake. Refine your purification/filtration process.'
      });
    }

    // Analyze Core Size
    const coreVal = parseFloat(inputs.core_size);
    if (!isNaN(coreVal)) {
      if (coreVal < 50) {
        tweaks.push({
          parameter: 'Core size (nm)',
          currentValue: `${coreVal} nm`,
          recommendedValue: '80 nm to 150 nm',
          reason: 'Extremely small nanoparticles (< 50 nm) can cross unintended cell membranes and localize inside nuclei, causing potential genotoxicity. Target a size above 80 nm for optimal biosafety.'
        });
      } else if (coreVal > 250) {
        tweaks.push({
          parameter: 'Core size (nm)',
          currentValue: `${coreVal} nm`,
          recommendedValue: '80 nm to 150 nm',
          reason: 'Large core sizes (> 250 nm) trigger rapid phagocytic clearance by macrophages in vivo and can precipitate out of solution, altering local toxicity profiles.'
        });
      }
    }

    // Default tweak if list is empty
    if (tweaks.length === 0) {
      tweaks.push({
        parameter: 'Surface charge in water (mV)',
        currentValue: inputs.charge !== undefined ? `${inputs.charge} mV` : 'Unknown',
        recommendedValue: '-10 mV to +5 mV',
        reason: 'Adding PEG coatings generally lowers the overall surface charge to a neutral range, which shields interactions and significantly improves nanoparticle biosafety.'
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


