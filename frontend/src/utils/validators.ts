/**
 * src/utils/validators.ts
 * Validation rules and Zod schemas matching docs/API_CONTRACT.md:
 * - Email: RFC 5322 valid format
 * - Password: >8 chars, at least 1 uppercase, at least 1 lowercase, at least 1 special char
 */
import { z } from 'zod';

// ─── Live Password Rule Helper ─────────────────────────────────────────────
export interface PasswordRuleCheck {
  id: string;
  label: string;
  met: boolean;
}

export function evaluatePasswordRules(password: string = ''): PasswordRuleCheck[] {
  return [
    {
      id: 'length',
      label: 'More than 8 characters (at least 9)',
      met: password.length > 8,
    },
    {
      id: 'uppercase',
      label: 'At least one uppercase letter (A-Z)',
      met: /[A-Z]/.test(password),
    },
    {
      id: 'lowercase',
      label: 'At least one lowercase letter (a-z)',
      met: /[a-z]/.test(password),
    },
    {
      id: 'special',
      label: 'At least one special character (!@#$%^&*...)',
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];
}

export function isPasswordValid(password: string = ''): boolean {
  return evaluatePasswordRules(password).every((rule) => rule.met);
}

// ─── Password Schema ───────────────────────────────────────────────────────
export const passwordValidator = z
  .string()
  .min(1, 'Password is required')
  .refine((val) => val.length > 8, {
    message: 'Password must be longer than 8 characters (at least 9 characters)',
  })
  .refine((val) => /[A-Z]/.test(val), {
    message: 'Password must contain at least one uppercase letter',
  })
  .refine((val) => /[a-z]/.test(val), {
    message: 'Password must contain at least one lowercase letter',
  })
  .refine((val) => /[^A-Za-z0-9]/.test(val), {
    message: 'Password must contain at least one special character',
  });

// ─── Login Schema ──────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginFormData = z.infer<typeof loginSchema>;

// ─── Register Schema ───────────────────────────────────────────────────────
export const registerSchema = z
  .object({
    full_name: z
      .string()
      .min(1, 'Full name is required')
      .max(255, 'Full name cannot exceed 255 characters'),
    email: z
      .string()
      .min(1, 'Email address is required')
      .email('Please enter a valid email address'),
    password: passwordValidator,
    confirm_password: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });
export type RegisterFormData = z.infer<typeof registerSchema>;

// ─── Forgot Password Schema ────────────────────────────────────────────────
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address'),
});
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

// ─── Reset Password Schema ─────────────────────────────────────────────────
export const resetPasswordSchema = z
  .object({
    password: passwordValidator,
    confirm_password: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
