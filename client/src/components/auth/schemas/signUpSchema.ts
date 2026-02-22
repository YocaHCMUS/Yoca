/**
 * Sign Up Form Validation Schema
 * Defines validation rules for user registration
 *
 * Note: Error messages use keys that will be translated by the component
 * using react-i18next. The component is responsible for translating these keys.
 */

import { z } from "zod";

export const signUpSchema = z
  .object({
    email: z
      .string()
      .min(1, "validation.emailRequired")
      .email("validation.invalidEmail"),

    displayName: z
      .string()
      .min(1, "validation.usernameRequired")
      .min(3, "validation.usernameTooShort")
      .max(20, "validation.usernameTooLong")
      .regex(/^[a-zA-Z0-9_]+$/, "validation.usernameInvalidChars"),

    password: z
      .string()
      .min(1, "validation.passwordRequired")
      .min(8, "validation.passwordTooShort")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "validation.passwordComplexity",
      ),

    retypePassword: z.string().min(1, "validation.confirmPasswordRequired"),
  })
  .refine((data) => data.password === data.retypePassword, {
    message: "validation.passwordsDoNotMatch",
    path: ["retypePassword"],
  });

export type SignUpFormData = z.infer<typeof signUpSchema>;
