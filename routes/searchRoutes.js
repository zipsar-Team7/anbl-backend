import express from 'express';
import { 
  getFilters, 
  searchMaterials, 
  getMaterialById 
} from '../controllers/searchController.js';

const router = express.Router();

// Routes for the scientific search engine
router.get('/filters', getFilters);
router.post('/search', searchMaterials);
router.get('/records/:id', getMaterialById);

export default router;
