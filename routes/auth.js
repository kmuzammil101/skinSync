import express from 'express';
import { validate } from '../middleware/validation.js';
import { imageUpload } from '../middleware/upload.js';
import { uploadToS3 } from "../utils/s3.js";
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

//adding line
// Verify OTP
router.post('/verify-otp',
  validate(verifyOTPSchema),
  verifyOTP
);

// Complete profile (for new users)
router.post('/complete-profile',
  // Accept either a file upload or just fields (no file)
  (req, res, next) => {
    // If Content-Type is multipart/form-data but no file field is present,
    // allow parsing of only fields so Zod can validate arrays correctly
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      // Try parsing without files first
      return imageUpload.none()(req, res, next);
    }
    return next();
  },
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

// Upload single image - returns URL
router.post("/upload/single", imageUpload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image uploaded" });
    }

    const fileName = `${Date.now()}-${req.file.originalname}`;
    const url = await uploadToS3(req.file.buffer, fileName, req.file.mimetype);

    return res.json({ success: true, data: { url } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Upload failed" });
  }
});

// ✅ Upload multiple images
router.post("/upload/multiple", imageUpload.multiple("images", 10), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ success: false, message: "No images uploaded" });
    }

    const urls = [];
    for (const file of files) {
      const fileName = `${Date.now()}-${file.originalname}`;
      const url = await uploadToS3(file.buffer, fileName, file.mimetype);
      urls.push(url);
    }

    return res.json({ success: true, data: { urls } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Upload failed" });
  }
});

export default router;