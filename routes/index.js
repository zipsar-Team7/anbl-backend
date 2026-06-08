import express from 'express';
import citationRoutes from './citationRoutes.js';
import searchRoutes from './searchRoutes.js';
import predictionRoutes from './predictionRoutes.js';

const router = express.Router();

// Mount all specific routes here
router.use('/citations', citationRoutes);
router.use('/predict', predictionRoutes);
router.use('/', searchRoutes); // Mounts /filters, /search, and /records/:id

// Health check for the API
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'success', 
    message: 'ANBL API is running smoothly.' 
  });
});

// Trigger reload comment
export default router;
