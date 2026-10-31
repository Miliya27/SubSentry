/**
 * src/pages/ForgotPasswordPage.tsx
 * Submits user email to POST /auth/forgot-password.
 * Always renders a neutral success message to prevent user enumeration.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { authService } from '../services/auth';
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from '../utils/validators';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  async function onSubmit(data: ForgotPasswordFormData) {
    try {
      await authService.forgotPassword(data.email.trim());
    } catch {
      // Intentionally silent on error as per security guidelines & contract:
      // Always show neutral confirmation regardless of server status or existence
    } finally {
      setSubmitted(true);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Reset password</h2>
        <p className="text-xs text-slate-500 mt-1">
          Enter your email address and we&apos;ll send you instructions to reset your password.
        </p>
      </div>

      {submitted ? (
        <div className="space-y-4" id="forgot-password-success-view">
          <div className="alert-success" role="status">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600" />
            <div className="text-xs text-emerald-900 space-y-1">
              <p className="font-semibold">Reset request received</p>
              <p>
                If that email address is registered in our system, you will receive a password reset link shortly.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Didn&apos;t receive the email? Check your spam folder or ensure the email provided is correct.
          </p>

          <Link
            to="/login"
            className="btn btn-secondary w-full"
            id="forgot-back-to-login-button"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="forgot-email-input">
              Email address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="h-4 w-4" />
              </div>
              <input
                id="forgot-email-input"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                className={`input pl-9 ${errors.email ? 'input-error' : ''}`}
                {...register('email')}
              />
            </div>
            {errors.email && (
              <p className="error-msg" id="forgot-email-error">{errors.email.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full mt-2"
            disabled={isSubmitting}
            id="forgot-submit-button"
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Sending reset link...
              </>
            ) : (
              'Send reset link'
            )}
          </Button>

          <div className="pt-2 text-center text-xs text-slate-500">
            Remember your password?{' '}
            <Link
              to="/login"
              className="font-semibold text-primary-600 hover:text-primary-700"
              id="forgot-login-link"
            >
              Sign in
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
