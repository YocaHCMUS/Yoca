/**
 * Zod Validation Schema for Sign In Form
 * Validates user credentials for authentication
 */

import { z } from 'zod';

/**
 * Sign-in form validation schema
 * Supports both email and username authentication
 */
export const signInSchema = z.object({
  /**
   * Username or Email field
   * Accepts either format for flexible authentication
   */
  identifier: z
    .string()
    .min(1, 'Username or email is required')
    .refine(
      (value) => {
        // Check if it's a valid email or username (3+ chars)
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        const isUsername = value.length >= 3;
        return isEmail || isUsername;
      },
      {
        message: 'Please enter a valid email or username (minimum 3 characters)',
      }
    ),

  /**
   * Password field
   * Minimum 6 characters for security
   */
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

/**
 * TypeScript type inferred from schema
 * Use this type for form data throughout the application
 */
export type SignInFormData = z.infer<typeof signInSchema>;
