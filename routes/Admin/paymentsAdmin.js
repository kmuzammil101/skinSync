import express from 'express';
import { authorizeAdmin } from '../../middleware/auth.js';
import { refundUser, releaseHeldPayment } from '../../controllers/Admin/paymentAdminController.js';

const router = express.Router();
// All routes require admin authentication
router.use(authorizeAdmin);

// release held payment for clinic
router.post('/:transactionId/release', authorizeAdmin, releaseHeldPayment);
//refund payment to user
router.post('/refund/:appointmentId', authorizeAdmin, refundUser);


export default router;