import express from 'express';
import citationRoutes from './citationRoutes.js';
import searchRoutes from './searchRoutes.js';

const router = express.Router();

// Mount all specific routes here
router.use('/citations', citationRoutes);
router.use('/', searchRoutes); // Mounts /filters, /search, and /records/:id

// Health check for the API
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'success', 
    message: 'ANBL API is running smoothly.' 
  });
});

export default router;
