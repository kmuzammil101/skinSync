import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getClinics,
  getClinicById,
  createClinic,
  updateClinic,
  deleteClinic,
  addReview,
  updateReview,
  deleteReview,
  getClinicReviews,
  getClinicsByLocation
} from '../controllers/clinicController.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/', getClinics);
router.get('/location', getClinicsByLocation);
router.get('/:id', getClinicById);
router.get('/:id/reviews', getClinicReviews);

// Protected routes (authentication required)
router.use(authenticateToken);

// Create clinic (admin only - you might want to add role-based auth)
router.post('/', createClinic);

// Update clinic
router.put('/:id', updateClinic);

// Delete clinic (soft delete)
router.delete('/:id', deleteClinic);

// Review management
router.post('/:id/reviews', addReview);
router.put('/:id/reviews', updateReview);
router.delete('/:id/reviews', deleteReview);

export default router;
