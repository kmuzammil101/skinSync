import express from 'express';
import { clinicLogin, clinicSignup, resendClinicOTP, resendForgetPassOTP, resetClinicPassword, sendClinicOTP, sendForgetPassOTP, verifyClinicOTP, verifyForgetPassOTP } from '../../controllers/clinicAuthController.js';

const router = express.Router();

// Send OTP to clinic email
router.post('/send-otp', sendClinicOTP);

// Verify OTP and create clinic account
router.post('/verify-otp', verifyClinicOTP);

router.post('/resend-otp', resendClinicOTP);

router.post('/signup', clinicSignup);
router.post('/login', clinicLogin);

//forget pass
router.post('/send-forget-pass-otp',sendForgetPassOTP)
router.post('/verify-forget-pass-otp',verifyForgetPassOTP)
router.post('/resend-forget-pass-otp',resendForgetPassOTP)
router.post('/reset-clinic-password',resetClinicPassword)

export default router;
