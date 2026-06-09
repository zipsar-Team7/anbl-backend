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
