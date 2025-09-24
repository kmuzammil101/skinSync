import { z } from 'zod';

// Phone number validation schema
const phoneSchema = z.string()
  .regex(/^[\+]?[1-9][\d]{0,15}$/, 'Please provide a valid phone number')
  .optional();

// Name validation schema
const nameSchema = z.string()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name cannot exceed 50 characters')
  .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces')
  .optional();

// Location validation schema
const locationSchema = z.string()
  .max(100, 'Location cannot exceed 100 characters')
  .optional();

// Bio validation schema
const bioSchema = z.string()
  .max(500, 'Bio cannot exceed 500 characters')
  .optional();

// Update profile schema
export const updateProfileSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  location: locationSchema,
  bio: bioSchema
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update'
});

// Update notification preferences schema
export const updateNotificationPreferencesSchema = z.object({
  notificationsEnabled: z.boolean({
    required_error: 'Notifications enabled is required',
    invalid_type_error: 'Notifications enabled must be a boolean value'
  })
});
