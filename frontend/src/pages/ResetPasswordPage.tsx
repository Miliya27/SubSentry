/**
 * src/pages/ResetPasswordPage.tsx
 * Reads ?token= from URL, evaluates live password rules,
 * and submits new credentials to POST /auth/reset-password.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  Lock,
} from 'lucide-react';
import { authService } from '../services/auth';
import { getErrorMessage, getFieldErrors } from '../services/api';
import {
  resetPasswordSchema,
  evaluatePasswordRules,
  type ResetPasswordFormData,
} from '../utils/validators';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token');

  const [serverError, setServerError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
    defaultValues: {
      password: '',
      confirm_password: '',
    },
  });

  const passwordValue = watch('password') || '';
  const passwordRules = evaluatePasswordRules(passwordValue);

  async function onSubmit(data: ResetPasswordFormData) {
    if (!token) {
      setServerError('Reset token is missing. Please request a new reset link.');
      return;
    }

    setServerError(null);
    try {
      await authService.resetPassword(token, data.password);
      setResetSuccess(true);
    } catch (err: unknown) {
      const fieldErrors = getFieldErrors(err);
      if (fieldErrors['password'] || fieldErrors['new_password']) {
        setError('password', {
          type: 'server',
          message: fieldErrors['password'] || fieldErrors['new_password'],
        });
      } else {
        const msg = getErrorMessage(err);
        setServerError(msg);
      }
    }
  }

  // If no token in query params
  if (!token && !resetSuccess) {
    return (
      <div className="space-y-5" id="reset-missing-token-view">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Missing Reset Token</h2>
          <p className="text-xs text-slate-500">
            We couldn&apos;t find a valid reset token in this URL. Please verify you opened the complete link from your email.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <Link
            to="/forgot-password"
            className="btn btn-primary w-full"
            id="request-new-link-button"
          >
            Request new reset link
          </Link>
          <Link
            to="/login"
            className="btn btn-secondary w-full"
            id="back-to-login-link"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Set new password</h2>
        <p className="text-xs text-slate-500 mt-1">
          Please enter your new password below.
        </p>
      </div>

      {resetSuccess ? (
        <div className="space-y-5" id="reset-success-view">
          <div className="alert-success" role="status">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600" />
            <div className="text-xs text-emerald-900 space-y-1">
              <p className="font-semibold">Password updated successfully</p>
              <p>Your password has been changed. You can now sign in with your new credentials.</p>
            </div>
          </div>

          <Button
            type="button"
            className="w-full"
            onClick={() => navigate('/login')}
            id="reset-success-login-button"
          >
            Continue to Sign in
          </Button>
        </div>
      ) : (
        <>
          {serverError && (
            <div className="alert-error" role="alert" id="reset-error-alert">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <span className="font-semibold">Reset failed: </span>
                {serverError}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label className="label" htmlFor="reset-password-input">
                New password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="reset-password-input"
                  type="password"
                  autoComplete="new-password"
                  placeholder="NewStrong@123"
                  className={`input pl-9 ${errors.password ? 'input-error' : ''}`}
                  {...register('password')}
                />
              </div>
              {errors.password && (
                <p className="error-msg" id="reset-password-error">{errors.password.message}</p>
              )}

              {/* Live password rule checklist */}
              <div
                className="mt-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1.5"
                id="reset-password-rules"
              >
                <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  Password requirements:
                </p>
                <ul className="space-y-1 text-xs">
                  {passwordRules.map((rule) => (
                    <li
                      key={rule.id}
                      className={`flex items-center gap-2 transition-colors ${
                        rule.met ? 'text-emerald-700 font-medium' : 'text-slate-500'
                      }`}
                      id={`reset-rule-${rule.id}`}
                    >
                      {rule.met ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                      )}
                      <span>{rule.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="reset-confirm-input">
                Confirm new password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="reset-confirm-input"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={`input pl-9 ${errors.confirm_password ? 'input-error' : ''}`}
                  {...register('confirm_password')}
                />
              </div>
              {errors.confirm_password && (
                <p className="error-msg" id="reset-confirm-error">{errors.confirm_password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full mt-2"
              disabled={isSubmitting}
              id="reset-submit-button"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Updating password...
                </>
              ) : (
                'Update password'
              )}
            </Button>
          </form>

          <div className="pt-2 text-center text-xs text-slate-500">
            <Link
              to="/login"
              className="font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
              id="reset-cancel-link"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign in
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
