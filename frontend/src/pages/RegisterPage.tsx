/**
 * src/pages/RegisterPage.tsx
 * Customer registration page with live password rule checklist,
 * RFC 5322 email validation, and 409 conflict mapping to the email field.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Check, Circle, Lock, Mail, User } from 'lucide-react';
import { authService } from '../services/auth';
import { getErrorMessage, getFieldErrors, getErrorCode } from '../services/api';
import {
  registerSchema,
  evaluatePasswordRules,
  type RegisterFormData,
} from '../utils/validators';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      confirm_password: '',
    },
  });

  const passwordValue = watch('password') || '';
  const passwordRules = evaluatePasswordRules(passwordValue);

  async function onSubmit(data: RegisterFormData) {
    setServerError(null);
    try {
      await authService.register({
        full_name: data.full_name.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
      });

      // Redirect to login with confirmation
      navigate('/login', {
        state: {
          message: 'Account created successfully! You can now sign in.',
        },
      });
    } catch (err: unknown) {
      const code = getErrorCode(err);
      const fieldErrors = getFieldErrors(err);

      // Requirement: Map backend 409 (duplicate email) to a field error
      if (code === 'CONFLICT' || fieldErrors['email']) {
        setError('email', {
          type: 'server',
          message: fieldErrors['email'] || 'An account with this email address already exists.',
        });
      } else if (fieldErrors['password']) {
        setError('password', {
          type: 'server',
          message: fieldErrors['password'],
        });
      } else {
        const msg = getErrorMessage(err);
        setServerError(msg);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Create your account</h2>
        <p className="text-xs text-slate-500 mt-1">
          Sign up to manage your subscriptions and invoices.
        </p>
      </div>

      {serverError && (
        <div className="alert-error" role="alert" id="register-error-alert">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <span className="font-semibold">Registration failed: </span>
            {serverError}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Full Name */}
        <div>
          <label className="label" htmlFor="register-name-input">
            Full name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <User className="h-4 w-4" />
            </div>
            <input
              id="register-name-input"
              type="text"
              autoComplete="name"
              placeholder="Riya Nair"
              className={`input pl-9 ${errors.full_name ? 'input-error' : ''}`}
              {...register('full_name')}
            />
          </div>
          {errors.full_name && (
            <p className="error-msg" id="register-name-error">{errors.full_name.message}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="label" htmlFor="register-email-input">
            Email address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Mail className="h-4 w-4" />
            </div>
            <input
              id="register-email-input"
              type="email"
              autoComplete="email"
              placeholder="riya@company.com"
              className={`input pl-9 ${errors.email ? 'input-error' : ''}`}
              {...register('email')}
            />
          </div>
          {errors.email && (
            <p className="error-msg" id="register-email-error">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="label" htmlFor="register-password-input">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Lock className="h-4 w-4" />
            </div>
            <input
              id="register-password-input"
              type="password"
              autoComplete="new-password"
              placeholder="Strong@123"
              className={`input pl-9 ${errors.password ? 'input-error' : ''}`}
              {...register('password')}
            />
          </div>
          {errors.password && (
            <p className="error-msg" id="register-password-error">{errors.password.message}</p>
          )}

          {/* Live password rule checklist */}
          <div
            className="mt-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1.5"
            id="password-rules-checklist"
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
                  id={`rule-${rule.id}`}
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

        {/* Confirm Password */}
        <div>
          <label className="label" htmlFor="register-confirm-password-input">
            Confirm password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Lock className="h-4 w-4" />
            </div>
            <input
              id="register-confirm-password-input"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className={`input pl-9 ${errors.confirm_password ? 'input-error' : ''}`}
              {...register('confirm_password')}
            />
          </div>
          {errors.confirm_password && (
            <p className="error-msg" id="register-confirm-error">{errors.confirm_password.message}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full mt-2"
          disabled={isSubmitting}
          id="register-submit-button"
        >
          {isSubmitting ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Creating account...
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>

      <div className="pt-2 text-center text-xs text-slate-500 border-t border-slate-100">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-semibold text-primary-600 hover:text-primary-700"
          id="register-login-link"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
