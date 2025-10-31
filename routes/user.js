import express from 'express';
import { validate } from '../middleware/validation.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  updateProfileSchema,
  updateNotificationPreferencesSchema
} from '../schemas/userSchemas.js';
import {
  getUserProfile,
  updateUserProfile,
  updateNotificationPreferences,
  deleteUserAccount,
  getUserTransactions
} from '../controllers/userController.js';
import { getUserWallet } from '../controllers/userWalletController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Routes
router.get('/profile', getUserProfile);

router.put('/profile',
  validate(updateProfileSchema),
  updateUserProfile
);

router.put('/notifications',
  validate(updateNotificationPreferencesSchema),
  updateNotificationPreferences
);

router.delete('/account', deleteUserAccount);

//transactions
router.get('/transactions',getUserTransactions)

// Wallet
router.get('/wallet', getUserWallet);

export default router;
