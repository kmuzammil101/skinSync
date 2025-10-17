import express from 'express';
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
  getClinicsByLocation,
  discountOnTreatment,
  upcomingAppointmentsOFClinic
} from '../../controllers/clinicController.js';

import { onboardClinic, getClinicWallet, withdrawFromWallet } from '../../controllers/clinicController.js';
import { authenticateClinicToken } from '../../middleware/clinicAuth.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/', getClinics);
router.get('/location', getClinicsByLocation);
router.get('/getClinicById/:id', getClinicById);
router.get('/:id/reviews', getClinicReviews);

// Protected routes (authentication required)
router.use(authenticateClinicToken);

// Create clinic (admin only - you might want to add role-based auth here)
router.post('/create-clinic', createClinic);

// Stripe Connect onboarding for clinic
router.post('/onboard', onboardClinic);

//create promotions and discounts
router.post('/discount-on-treatment', discountOnTreatment);

//get upcoming appointments
router.get('/upcoming-appointments', upcomingAppointmentsOFClinic);


// Clinic wallet endpoints
router.get('/:id/wallet', getClinicWallet);
router.post('/:id/withdraw', withdrawFromWallet);


// Update clinic
router.put('/:id', updateClinic);

// Delete clinic (soft delete)
router.delete('/:id', deleteClinic);

// Review management
router.post('/:id/reviews', addReview);
router.put('/:id/reviews', updateReview);
router.delete('/:id/reviews', deleteReview);

export default router;
