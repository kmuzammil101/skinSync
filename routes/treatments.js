import express from 'express';
import { authenticateToken } from '../middleware/auth.js';

import {
  createTreatment,
  getTreatments,
  getTreatmentById,
  getTreatmentsByType,
  updateTreatment,
  deleteTreatment
} from '../controllers/treatmentController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create treatment (admin only - you might want to add role-based auth)
router.post('/', createTreatment);

// Get all treatments
router.get('/', getTreatments);

// Get treatment by ID
router.get('/:id', getTreatmentById);

// Get treatments by type
router.get('/type/:type', getTreatmentsByType);

// Update treatment
router.put('/:id', updateTreatment);

// Delete treatment
router.delete('/:id', deleteTreatment);

export default router;
