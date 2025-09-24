import express from 'express';
import { validate } from '../middleware/validation.js';
import { imageUpload } from '../middleware/upload.js';
import {
  sendOTPSchema,
  verifyOTPSchema,
  completeProfileSchema,
  socialLoginSchema
} from '../schemas/authSchemas.js';
import {
  sendOTP,
  verifyOTP,
  completeProfile,
  resendOTP,
  socialLogin
} from '../controllers/authController.js';

const router = express.Router();

// Routes for passwordless authentication

// Send OTP for registration/login
router.post('/send-otp', 
  validate(sendOTPSchema),
  sendOTP
);

// Verify OTP
router.post('/verify-otp',
  validate(verifyOTPSchema),
  verifyOTP
);

// Complete profile (for new users)
router.post('/complete-profile',
  imageUpload.single('profileImageFile'),
  validate(completeProfileSchema),
  completeProfile
);

// Resend OTP
router.post('/resend-otp',
  validate(sendOTPSchema),
  resendOTP
);

// Social login (Google/Apple)
router.post('/social-login',
  validate(socialLoginSchema),
  socialLogin
);

export default router;