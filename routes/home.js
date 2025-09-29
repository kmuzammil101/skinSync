import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getHomeData, getLoyaltyPoints, addLoyaltyPoints } from '../controllers/homeController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get home page data
router.get('/home', getHomeData);

// Get loyalty points
router.get('/loyalty', getLoyaltyPoints);

// Add loyalty points
router.post('/loyalty/add', addLoyaltyPoints);

export default router;
