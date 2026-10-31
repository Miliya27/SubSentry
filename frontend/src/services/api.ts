/**
 * src/services/api.ts
 * Axios instance with auth token injection, real error envelope handling, and 401 redirect.
 * Base URL is read from the VITE_API_BASE_URL environment variable (default: http://localhost:8000/api/v1).
 */
import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { ApiResponse } from '../types';

// ─── Constants ─────────────────────────────────────────────────────────────
const TOKEN_KEY = 'subsentry_access_token';
const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  'http://localhost:8000/api/v1';

// ─── Axios Instance ────────────────────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15_000,
});

// ─── Request Interceptor: attach Bearer token ──────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response Interceptor: handle 401 ─────────────────────────────────────
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url || '';
      // Do not redirect if the failed request was the login or register endpoint itself
      const isAuthEndpoint =
        url.includes('/auth/login') || url.includes('/auth/register');

      if (!isAuthEndpoint) {
        localStorage.removeItem(TOKEN_KEY);
        // Avoid infinite reload if already on /login
        if (window.location.pathname !== '/login') {
          window.location.replace('/login');
        }
      }
    }
    return Promise.reject(error);
  }
);

// ─── Token Helpers ─────────────────────────────────────────────────────────
export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// ─── Error Envelope Helpers ────────────────────────────────────────────────
/**
 * Extracts the top-level error message according to docs/API_CONTRACT.md envelope:
 * { success: false, error: { code, message, details: [{ field, message }] } }
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as ApiResponse<unknown> | undefined;

    if (payload && payload.error) {
      const err = payload.error;
      // If there are field details and no top-level message, join them
      if (err.details && Array.isArray(err.details) && err.details.length > 0) {
        // Return top-level message if informative, or the first detail
        if (err.message && err.message !== 'Request validation failed.') {
          return err.message;
        }
        return err.details.map((d) => d.message).join('; ');
      }
      if (err.message) {
        return err.message;
      }
    }

    // Network & HTTP status fallbacks
    if (error.code === 'ECONNABORTED') return 'Request timed out. Please try again.';
    if (!error.response) return 'Network error. Please check if the server is running.';

    const status = error.response.status;
    if (status === 401) return 'Invalid credentials or session expired.';
    if (status === 403) return 'You do not have permission to perform this action.';
    if (status === 404) return 'The requested resource was not found.';
    if (status === 409) return 'A resource with these details already exists.';
    if (status === 422) return 'Validation error. Please verify your input.';
    if (status >= 500) return 'Internal server error. Please try again later.';
  }

  if (error instanceof Error) return error.message;

  return 'An unexpected error occurred.';
}

/**
 * Extracts field-level validation errors from the contract error details:
 * [{ field: "password", message: "..." }] or [{ field: "body.password", message: "..." }]
 * Returns Record<string, string> keyed by simple field name ("password", "email", etc.)
 */
export function getFieldErrors(error: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as ApiResponse<unknown> | undefined;
    const details = payload?.error?.details;
    if (Array.isArray(details)) {
      for (const item of details) {
        if (item.field && item.message) {
          // Normalize "body.password" or "password" -> "password"
          const cleanField = item.field.replace(/^body\./, '');
          result[cleanField] = item.message;
        }
      }
    }
  }
  return result;
}

/**
 * Extracts error code from contract response (e.g., 'VALIDATION_ERROR', 'CONFLICT', 'UNAUTHENTICATED')
 */
export function getErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as ApiResponse<unknown> | undefined;
    return payload?.error?.code;
  }
  return undefined;
}

export default api;
