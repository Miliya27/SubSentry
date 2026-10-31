/**
 * src/services/api.ts
 * Axios instance with auth token injection and 401 handling.
 * Base URL is read from the VITE_API_BASE_URL environment variable.
 */
import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { ApiError } from '../types';

// ─── Constants ─────────────────────────────────────────────────────────────
const TOKEN_KEY = 'subsentry_access_token';
const BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

if (!BASE_URL) {
  console.warn(
    '[api] VITE_API_BASE_URL is not set. Requests will fail. ' +
      'Copy .env.example to .env and set the value.'
  );
}

// ─── Axios Instance ────────────────────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL ?? '',
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
      // Clear stored token and redirect to login
      localStorage.removeItem(TOKEN_KEY);
      // Use replace to avoid back-button loops
      window.location.replace('/login');
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

// ─── Error Envelope Helper ─────────────────────────────────────────────────
/**
 * Converts an API error response into a human-readable message string.
 * Handles the contract's error envelope shape:
 *   { detail: string, code?: string, field_errors?: Record<string, string[]> }
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiError | undefined;

    if (data) {
      // Collect field-level errors first
      if (data.field_errors) {
        const fieldMessages = Object.entries(data.field_errors)
          .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
          .join('; ');
        if (fieldMessages) return fieldMessages;
      }

      if (data.detail) return data.detail;
    }

    // Network-level errors
    if (error.code === 'ECONNABORTED') return 'Request timed out. Please try again.';
    if (!error.response) return 'Network error. Check your connection.';

    const status = error.response.status;
    if (status === 403) return 'You do not have permission to perform this action.';
    if (status === 404) return 'The requested resource was not found.';
    if (status === 422) return 'Validation error. Please check your input.';
    if (status >= 500) return 'Server error. Please try again later.';
  }

  if (error instanceof Error) return error.message;

  return 'An unexpected error occurred.';
}

export default api;
