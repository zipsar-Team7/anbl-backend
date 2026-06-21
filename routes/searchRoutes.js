import express from 'express';
import { 
  getFilters, 
  searchMaterials, 
  getMaterialById,
  getPolyToxFilters,
  searchPolyTox,
  getPolyToxById
} from '../controllers/searchController.js';
import { 
  predictPolyTox, 
  getPolyToxMetadata,
  suggestPolyToxOptimization 
} from '../controllers/predictController.js';
import { 
  predictNeuro,
  suggestNeuroOptimization 
} from '../controllers/neuroPredictController.js';

const router = express.Router();

// Routes for the scientific search engine (Neuro-Bio-Axis)
router.get('/filters', getFilters);
router.post('/search', searchMaterials);
router.get('/records/:id', getMaterialById);

// Routes for the Poly-ToxMap search engine
router.get('/polytox/filters', getPolyToxFilters);
router.post('/polytox/search', searchPolyTox);
router.get('/polytox/records/:id', getPolyToxById);
router.post('/polytox/predict', predictPolyTox);
router.get('/polytox/metadata', getPolyToxMetadata);
router.post('/polytox/suggest', suggestPolyToxOptimization);

// Routes for the Neuro-Bio-Axis Predictor
router.post('/neuro/predict', predictNeuro);
router.post('/neuro/suggest', suggestNeuroOptimization);

export default router;

