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

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create treatment (admin only - you might want to add role-based auth)
router.post('/create-treatment', createTreatment);

// Get all treatments
router.get('/get-treatments', getTreatments);

//get all types of treatment
router.get('/get-treatment-type',getTreatmentType)


// Get treatment by ID
router.get('/get-treatment-by-id/:id', getTreatmentById);

//get Treatment subTypes
router.get('/get-treatment-subType',getTreatmentSubtype)


// Get treatments by type
router.get('/type/:type', getTreatmentsByType);

// Update treatment
router.put('/:id', updateTreatment);

// Delete treatment
router.delete('/:id', deleteTreatment);

// Get recommended treatments based on user profile
router.get('/recommended',getRecommendedTreatments);

export default router;
