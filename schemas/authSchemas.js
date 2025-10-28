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



// Signup schema
export const signupSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name cannot exceed 50 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  
  email: emailSchema,

  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .max(100, 'Password cannot exceed 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[@$!%*?&#]/, 'Password must contain at least one special character'),

  phone: z.string()
    .regex(/^[\+]?[1-9][\d]{7,14}$/, 'Please provide a valid phone number'),
});


// Send OTP for registration/login schema
export const sendOTPSchema = z.object({
  email: emailSchema,
  type: z.enum(['email_verification', 'phone_verification'], {
    required_error: 'Verification type is required',
    invalid_type_error: 'Invalid verification type',
  }),
});

// Verify OTP schema (for both registration and login)
export const verifyOTPSchema = z.object({
  email: emailSchema,
  code: verificationCodeSchema,
  type: z.enum(['email_verification', 'phone_verification'], {
    required_error: 'Verification type is required',
    invalid_type_error: 'Invalid verification type',
  }),
});

// Complete profile after OTP verification schema
export const completeProfileSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name cannot exceed 50 characters')
    .regex(/^[a-zA-Z0-9\s]+$/, 'Name can only contain letters, numbers, and spaces'),

  phone: z.string()
    .regex(/^[\+]?[1-9][\d]{0,15}$/, 'Please provide a valid phone number')
    .optional(),

  location: z.string()
    .max(100, 'Location cannot exceed 100 characters')
    .optional(),

  bio: z.string()
    .max(500, 'Bio cannot exceed 500 characters')
    .optional(),

  email: emailSchema,

  profileImage: z.string().optional(),
  skintype: z.array(z.string()).optional(),
  skinConcerns: z.array(z.string()).optional(),
  lifestyle: z.array(z.string()).optional(),
  skinCondition: z.array(z.string()).optional(),
  medication: z.string().optional(),
  skinGoals: z.array(z.string()).optional(),
  isOnboardingCompleted: z.boolean().default(false)
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