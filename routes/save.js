import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getSavedItems, toggleSave } from '../controllers/saveController.js';


const router = express.Router();

router.use(authenticateToken);

router.post("/toggle-save", toggleSave);

router.get("/saved-items", getSavedItems);

export default router;