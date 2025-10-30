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
  upcomingAppointmentsOFClinic,
  homePageDataOfClinic,
  getAppointmentsOfClinicByDate
} from '../../controllers/clinicController.js';

import { onboardClinic, getClinicWallet, withdrawFromWallet } from '../../controllers/clinicController.js';
import { authenticateClinicToken } from '../../middleware/clinicAuth.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/', getClinics);
router.get('/location', getClinicsByLocation);
router.get('/:id/reviews', getClinicReviews);
router.get('/getClinicById/:id', authenticateToken, getClinicById);

// Protected routes (authentication required)
router.use(authenticateClinicToken);

// Clinic wallet endpoints
router.get('/wallet', getClinicWallet);
router.post('/:id/withdraw', withdrawFromWallet);


//home page of clinic dashboard
router.get('/home', homePageDataOfClinic);

router.get('/date/:date', getAppointmentsOfClinicByDate);

// Create clinic (admin only - you might want to add role-based auth here)
router.post('/create-clinic', createClinic);

// Stripe Connect onboarding for clinic
router.post('/onboard', onboardClinic);

//update promotions and discounts
router.patch('/discount-on-treatment', discountOnTreatment);

//get upcoming appointments
router.get('/upcoming-appointments', upcomingAppointmentsOFClinic);




// Update clinic
router.put('/:id', updateClinic);

// Delete clinic (soft delete)
router.delete('/:id', deleteClinic);

// Review management
router.post('/:id/reviews', addReview);
router.put('/:id/reviews', updateReview);
router.delete('/:id/reviews', deleteReview);

export default router;
