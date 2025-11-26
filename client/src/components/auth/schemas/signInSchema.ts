/**
 * Zod Validation Schema for Sign In Form
 * Validates user credentials for authentication
 * 
 * Note: Error messages use keys that will be translated by the component
 * using react-i18next. The component is responsible for translating these keys.
 */

import { z } from 'zod';

/**
 * Sign-in form validation schema
 * Supports both email and username authentication
 * Error messages are translation keys that will be resolved by the component
 */
export const signInSchema = z.object({
  /**
   * Username or Email field
   * Accepts either format for flexible authentication
   */
  identifier: z
    .string()
    .min(1, 'validation.identifierRequired')
    .refine(
      (value) => {
        // Check if it's a valid email or username (3+ chars)
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        const isUsername = value.length >= 3;
        return isEmail || isUsername;
      },
      {
        message: 'validation.identifierInvalid',
      }
    ),

  /**
   * Password field
   * Minimum 6 characters for security
   */
  password: z
    .string()
    .min(1, 'validation.passwordRequired')
    .min(6, 'validation.passwordTooShort'),
});

/**
 * TypeScript type inferred from schema
 * Use this type for form data throughout the application
 */
export type SignInFormData = z.infer<typeof signInSchema>;
