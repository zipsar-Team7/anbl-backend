import express from 'express';
import { predictPolyTox } from '../controllers/predictionController.js';

const router = express.Router();

router.post('/poly-toxmap', predictPolyTox);

export default router;
