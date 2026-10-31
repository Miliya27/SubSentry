/**
 * src/context/AuthContext.tsx
 * Authentication context – skeleton only (no backend calls in Stage 1).
 * Stores the current user and exposes login/logout helpers.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { setAuthToken, clearAuthToken, getAuthToken } from '../services/api';
import type { User, UserRole } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────────
interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

// ─── Context ───────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

// ─── DEV MOCK USER (to view layout during Stage 1) ─────────────────────────
// DEV MOCK - REMOVE BEFORE FINAL
const DEV_MOCK_USER: User = {
  id: 'dev-admin-1',
  email: 'admin@subsentry.dev',
  name: 'Dev Admin',
  role: 'admin' as UserRole,
};

// ─── Provider ──────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: restore session from localStorage (token check only)
  useEffect(() => {
    const storedToken = getAuthToken();
    if (storedToken) {
      setToken(storedToken);
      // DEV MOCK - REMOVE BEFORE FINAL: auto-set dev user when token exists
      setUser(DEV_MOCK_USER);
    } else {
      // DEV MOCK - REMOVE BEFORE FINAL: seed a fake token so layout is visible
      const mockToken = 'dev-mock-token';
      setAuthToken(mockToken);
      setToken(mockToken);
      setUser(DEV_MOCK_USER);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((newToken: string, newUser: User) => {
    setAuthToken(newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    clearAuthToken();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
