import { z } from 'zod';

// Email validation schema
const emailSchema = z.string()
  .email('Please provide a valid email address')
  .min(1, 'Email is required')
  .max(255, 'Email is too long')
  .transform(email => email.toLowerCase().trim());

// Verification code schema
const verificationCodeSchema = z.string()
  .length(6, 'Verification code must be exactly 6 digits')
  .regex(/^\d{6}$/, 'Verification code must contain only numbers');

// Send OTP for registration/login schema
export const sendOTPSchema = z.object({
  email: emailSchema
});

// Verify OTP schema (for both registration and login)
export const verifyOTPSchema = z.object({
  email: emailSchema,
  code: verificationCodeSchema
});

// Complete profile after OTP verification schema
export const completeProfileSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name cannot exceed 50 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  phone: z.string()
    .regex(/^[\+]?[1-9][\d]{0,15}$/, 'Please provide a valid phone number')
    .optional(),
  location: z.string()
    .max(100, 'Location cannot exceed 100 characters')
    .optional(),
  bio: z.string()
    .max(500, 'Bio cannot exceed 500 characters')
    .optional(),
  email: emailSchema
});

// Social login schema
export const socialLoginSchema = z.object({
  type: z.enum(['google', 'apple'], {
    required_error: 'Social login type is required',
    invalid_type_error: 'Type must be either google or apple'
  }),
  email: emailSchema,
  name: z.string().min(2).max(50).optional(),
  idToken: z.string().optional() // Placeholder for provider token if needed
});