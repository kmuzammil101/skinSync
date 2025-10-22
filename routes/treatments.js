import express from 'express';
import { authenticateToken } from '../middleware/auth.js';

import {
  createTreatment,
  getTreatments,
  getTreatmentById,
  getTreatmentsByType,
  updateTreatment,
  deleteTreatment,
  getTreatmentType,
  getTreatmentSubtype,
  getRecommendedTreatments
} from '../controllers/treatmentController.js';
import { authenticateClinicToken } from '../middleware/clinicAuth.js';

const router = express.Router();

router.get('/get-treatment-subType', getTreatmentSubtype)
router.get('/get-treatment-type', getTreatmentType)
router.post('/create-treatment', authenticateClinicToken, createTreatment);

// All routes require authentication
router.use(authenticateToken);


// Get all treatments
router.get('/get-treatments', getTreatments);

// Get treatment by ID
router.get('/get-treatment-by-id/:id', getTreatmentById);


// Get treatments by type
router.get('/type/:type', getTreatmentsByType);

// Update treatment
router.put('/:id', updateTreatment);

// Delete treatment
router.delete('/:id', deleteTreatment);

// Get recommended treatments based on user profile
router.get('/recommended',getRecommendedTreatments);

export default router;
