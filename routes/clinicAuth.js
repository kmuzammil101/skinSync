import express from 'express';
import { sendClinicOTP, verifyClinicOTP } from '../controllers/clinicAuthController.js';

const router = express.Router();

// Send OTP to clinic email
router.post('/send-otp', sendClinicOTP);

// Verify OTP and create clinic account
router.post('/verify-otp', verifyClinicOTP);


export default router;
