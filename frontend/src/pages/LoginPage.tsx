/**
 * src/pages/LoginPage.tsx – Auth placeholder.
 */
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  // DEV MOCK - REMOVE BEFORE FINAL
  function handleDevLogin() {
    login('dev-mock-token', {
      id: 'dev-admin-1',
      email: 'admin@subsentry.dev',
      name: 'Dev Admin',
      role: 'admin',
    });
    navigate('/dashboard');
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Sign in</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Enter your credentials to access SubSentry.
        </p>
      </div>

      {/* Placeholder form – real implementation in Stage 2 */}
      <div className="space-y-3">
        <div>
          <label className="label" htmlFor="login-email">Email</label>
          <input id="login-email" type="email" className="input" placeholder="you@example.com" />
        </div>
        <div>
          <label className="label" htmlFor="login-password">Password</label>
          <input id="login-password" type="password" className="input" placeholder="••••••••" />
        </div>
      </div>

      <Button className="w-full" onClick={handleDevLogin} id="login-submit-button">
        Sign in
      </Button>

      <p className="text-xs text-slate-600 text-center">
        DEV MOCK – click Sign in to skip auth during Stage 1.
      </p>
    </div>
  );
}
