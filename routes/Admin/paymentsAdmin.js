import express from 'express';
import { authorizeAdmin } from '../../middleware/auth.js';
import { releaseHeldPayment } from '../../controllers/Admin/paymentAdminController.js';

const router = express.Router();
// All routes require admin authentication
router.use(authorizeAdmin);

// Get all payments
router.post('/:id/release', authorizeAdmin, releaseHeldPayment);


export default router;