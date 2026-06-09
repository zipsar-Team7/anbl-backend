import express from 'express';
import { 
  getFilters, 
  searchMaterials, 
  getMaterialById,
  getPolyToxFilters,
  searchPolyTox,
  getPolyToxById
} from '../controllers/searchController.js';
import { predictPolyTox } from '../controllers/predictController.js';

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

export default router;
