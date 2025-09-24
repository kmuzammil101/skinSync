import express from 'express';
import { validate, validateQuery, validateParams } from '../middleware/validation.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  getNotificationsQuerySchema,
  createNotificationSchema,
  notificationIdSchema
} from '../schemas/notificationSchemas.js';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  createNotification
} from '../controllers/notificationController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Routes
router.get('/',
  validateQuery(getNotificationsQuerySchema),
  getUserNotifications
);

router.put('/:notificationId/read', 
  validateParams(notificationIdSchema),
  markNotificationAsRead
);

router.put('/read-all', markAllNotificationsAsRead);

router.delete('/:notificationId', 
  validateParams(notificationIdSchema),
  deleteNotification
);

// Admin route for creating notifications
router.post('/create',
  validate(createNotificationSchema),
  createNotification
);

export default router;
