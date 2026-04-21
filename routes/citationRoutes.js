import express from 'express';
import { 
  getCitations, 
  getCitation 
} from '../controllers/citationController.js';

const router = express.Router();

router.route('/')
  .get(getCitations);

router.route('/:id')
  .get(getCitation);

export default router;
