/**
 * src/pages/LoginPage.tsx
 * Real Login page wired to backend POST /auth/login and GET /auth/me.
 * Redirects admin/staff to /dashboard and customer to /portal.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth';
import { getErrorMessage } from '../services/api';
import { loginSchema, type LoginFormData } from '../utils/validators';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [serverError, setServerError] = useState<string | null>(null);

  // Check if user was passed a success message (e.g. from register or reset password)
  const navState = location.state as { message?: string; from?: { pathname: string } } | null;
  const successMessage = navState?.message;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: LoginFormData) {
    setServerError(null);
    try {
      const authTokens = await authService.login(data);
      // Immediately fetch user profile using the new token
      // authService.login already returns access_token; getMe will use it
      localStorage.setItem('subsentry_access_token', authTokens.access_token);
      const userProfile = await authService.getMe();

      login(authTokens.access_token, userProfile);

      // Redirect by role according to specification:
      // admin/staff -> /dashboard, customer -> /portal
      const redirectTarget = navState?.from?.pathname;
      if (redirectTarget && !redirectTarget.startsWith('/login')) {
        navigate(redirectTarget, { replace: true });
      } else if (userProfile.role === 'customer') {
        navigate('/portal', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      setServerError(msg);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Sign in to SubSentry</h2>
        <p className="text-xs text-slate-500 mt-1">
          Enter your email and password to access your account.
        </p>
      </div>

      {successMessage && (
        <div className="alert-success" role="status">
          <p>{successMessage}</p>
        </div>
      )}

      {serverError && (
        <div className="alert-error" role="alert" id="login-error-alert">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <span className="font-semibold">Authentication failed: </span>
            {serverError}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="login-email-input">
            Email address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Mail className="h-4 w-4" />
            </div>
            <input
              id="login-email-input"
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              className={`input pl-9 ${errors.email ? 'input-error' : ''}`}
              {...register('email')}
            />
          </div>
          {errors.email && (
            <p className="error-msg" id="login-email-error">{errors.email.message}</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0" htmlFor="login-password-input">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
              id="login-forgot-link"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Lock className="h-4 w-4" />
            </div>
            <input
              id="login-password-input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className={`input pl-9 ${errors.password ? 'input-error' : ''}`}
              {...register('password')}
            />
          </div>
          {errors.password && (
            <p className="error-msg" id="login-password-error">{errors.password.message}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full mt-2"
          disabled={isSubmitting}
          id="login-submit-button"
        >
          {isSubmitting ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>

      <div className="pt-2 text-center text-xs text-slate-500 border-t border-slate-100">
        Don&apos;t have an account?{' '}
        <Link
          to="/register"
          className="font-semibold text-primary-600 hover:text-primary-700"
          id="login-register-link"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}
