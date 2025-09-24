import { z } from 'zod';

// Notification type enum
const notificationTypeEnum = z.enum([
  'appointment_reminder',
  'promotion',
  'clinic_update',
  'general'
]);

// Title validation schema
const titleSchema = z.string()
  .min(1, 'Title is required')
  .max(100, 'Title cannot exceed 100 characters')
  .trim();

// Message validation schema
const messageSchema = z.string()
  .min(1, 'Message is required')
  .max(500, 'Message cannot exceed 500 characters')
  .trim();

// MongoDB ObjectId validation
const mongoIdSchema = z.string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId');

// ISO date validation
const isoDateSchema = z.string()
  .datetime('Invalid date format')
  .optional();

// Get notifications query schema
export const getNotificationsQuerySchema = z.object({
  page: z.string()
    .regex(/^\d+$/, 'Page must be a positive integer')
    .transform(Number)
    .refine(val => val >= 1, 'Page must be at least 1')
    .optional()
    .default('1'),
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a positive integer')
    .transform(Number)
    .refine(val => val >= 1 && val <= 100, 'Limit must be between 1 and 100')
    .optional()
    .default('10'),
  type: notificationTypeEnum.optional(),
  isRead: z.string()
    .regex(/^(true|false)$/, 'isRead must be true or false')
    .transform(val => val === 'true')
    .optional()
});

// Create notification schema
export const createNotificationSchema = z.object({
  userId: mongoIdSchema,
  title: titleSchema,
  message: messageSchema,
  type: notificationTypeEnum.optional().default('general'),
  scheduledFor: isoDateSchema,
  metadata: z.record(z.any()).optional().default({})
});

// Notification ID parameter schema
export const notificationIdSchema = z.object({
  notificationId: mongoIdSchema
});
