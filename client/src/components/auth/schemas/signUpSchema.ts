/**
 * Sign Up Form Validation Schema
 * Defines validation rules for user registration
 * 
 * Note: Error messages use keys that will be translated by the component
 * using react-i18next. The component is responsible for translating these keys.
 */

import { z } from 'zod';

/**
 * Sign up form validation schema with comprehensive validation rules
 * Error messages are translation keys that will be resolved by the component
 */
export const signUpSchema = z
  .object({
    /**
     * Email address - required, must be valid format
     */
    email: z
      .string()
      .min(1, 'validation.emailRequired')
      .email('validation.invalidEmail'),

    /**
     * Username - required, alphanumeric with underscores, 3-20 characters
     */
    username: z
      .string()
      .min(1, 'validation.usernameRequired')
      .min(3, 'validation.usernameTooShort')
      .max(20, 'validation.usernameTooLong')
      .regex(
        /^[a-zA-Z0-9_]+$/,
        'validation.usernameInvalidChars'
      ),

    /**
     * Password - required, minimum 8 characters with complexity requirements
     */
    password: z
      .string()
      .min(1, 'validation.passwordRequired')
      .min(8, 'validation.passwordTooShort')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'validation.passwordComplexity'
      ),

    /**
     * Password confirmation - required, must match password
     */
    retypePassword: z.string().min(1, 'validation.confirmPasswordRequired'),

    /**
     * Terms acceptance - optional boolean for UI state
     */
    acceptTerms: z.boolean().optional(),
  })
  .refine((data) => data.password === data.retypePassword, {
    message: 'validation.passwordsDoNotMatch',
    path: ['retypePassword'], // Set error on retypePassword field
  });

/**
 * TypeScript type inferred from the schema
 */
export type SignUpFormData = z.infer<typeof signUpSchema>;
