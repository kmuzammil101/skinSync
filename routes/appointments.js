import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  createAppointment,
  getAppointments,
  getAppointmentById,
  getAppointmentsByDate,
  updateAppointmentStatus,
  cancelAppointment,
  getUpcomingAppointments
} from '../controllers/appointmentController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create appointment
router.post('/', createAppointment);


// Get all appointments for user
router.get('/', getAppointments);

// Get upcoming appointments
router.get('/upcoming', getUpcomingAppointments);

// Get appointment by ID
router.get('/:id', getAppointmentById);

// Get appointments by date
router.get('/date/:date', getAppointmentsByDate);

// Update appointment status
router.put('/:id/status', updateAppointmentStatus);

// Cancel appointment
router.put('/:id/cancel', cancelAppointment);

export default router;
