import express from 'express';
import { adminSignup, adminLogin } from '../../controllers/Admin/adminAuthController.js';

const router = express.Router();

// Admin signup
router.post('/signup', adminSignup);

// Admin login
router.post('/login', adminLogin);

export default router;
