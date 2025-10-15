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

import { onboardClinic, getClinicWallet, withdrawFromWallet, releaseHeldPayment } from '../controllers/clinicController.js';
import { authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/', getClinics);
router.get('/location', getClinicsByLocation);
router.get('/getClinicById/:id', getClinicById);
router.get('/:id/reviews', getClinicReviews);

// Protected routes (authentication required)
router.use(authenticateToken);

// Create clinic (admin only - you might want to add role-based auth here)
router.post('/create-clinic', createClinic);

// Stripe Connect onboarding for clinic
router.post('/onboard', onboardClinic);

// Clinic wallet endpoints
router.get('/:id/wallet', getClinicWallet);
router.post('/:id/withdraw', withdrawFromWallet);
// Admin releases held payments for a clinic into its in-app wallet (or optionally transfers to Stripe)
router.post('/:id/release', authorizeAdmin, releaseHeldPayment);

// Update clinic
router.put('/:id', updateClinic);

// Delete clinic (soft delete)
router.delete('/:id', deleteClinic);

// Review management
router.post('/:id/reviews', addReview);
router.put('/:id/reviews', updateReview);
router.delete('/:id/reviews', deleteReview);

export default router;
