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
  getNotificationById,
  getUnreadCount,
  getNotificationsByType,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
  createNotification,
  createAppointmentReminder,
  sendBulkNotification,
  sendTopicNotification,
  updateDeviceToken,
  removeDeviceToken
} from '../controllers/notificationController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Routes
router.get('/get-user-notifications',
  // validateQuery(getNotificationsQuerySchema),
  getUserNotifications
);

// Get unread notifications count
router.get('/unread-count', getUnreadCount);

// Get notifications by type
router.get('/type/:type', getNotificationsByType);

// Get notification by ID
router.get('/:notificationId', 
  validateParams(notificationIdSchema),
  getNotificationById
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

// Delete all notifications
router.delete('/', deleteAllNotifications);

// Admin route for creating notifications
router.post('/create',
  validate(createNotificationSchema),
  createNotification
);

// Create appointment reminder
router.post('/appointment-reminder', createAppointmentReminder);

// Device token management
router.put('/device-token', updateDeviceToken);
router.delete('/device-token', removeDeviceToken);

// Admin routes for bulk notifications
router.post('/bulk', sendBulkNotification);
router.post('/topic', sendTopicNotification);

export default router;
