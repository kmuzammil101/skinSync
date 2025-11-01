import express from 'express';
import { clinicLogin, clinicSignup, resendClinicOTP, resendForgetPassOTP, resetClinicPassword, sendClinicOTP, sendForgetPassOTP, verifyClinicOTP, verifyForgetPassOTP, clinicLogout, clinicSocialLogin } from '../../controllers/clinicAuthController.js';
import { authenticateClinicToken } from '../../middleware/clinicAuth.js';

const router = express.Router();

// Send OTP to clinic email
router.post('/send-otp', sendClinicOTP);

// Verify OTP and create clinic account
router.post('/verify-otp', verifyClinicOTP);

router.post('/resend-otp', resendClinicOTP);

router.post('/signup', clinicSignup);
router.post('/login', clinicLogin);

// Social login (Google/Apple)
router.post('/social-login', clinicSocialLogin);

//forget pass
router.post('/send-forget-pass-otp',sendForgetPassOTP)
router.post('/verify-forget-pass-otp',verifyForgetPassOTP)
router.post('/resend-forget-pass-otp',resendForgetPassOTP)
router.post('/reset-clinic-password',resetClinicPassword)

// Logout - requires authentication
router.post('/logout',
  authenticateClinicToken,
  clinicLogout
);

export default router;
