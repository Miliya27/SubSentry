/**
 * src/types/auth.ts
 * Type definitions for Authentication and User management derived from docs/API_CONTRACT.md
 */

export type UserRole = 'admin' | 'staff' | 'customer';

export interface User {
  id: number;
  email: string;
  full_name: string;
  name?: string; // backwards compatibility alias for full_name
  phone?: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  token_type: 'bearer' | string;
  expires_in?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface RegisterData {
  full_name: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  id: number;
  email: string;
  role: UserRole;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  new_password: string;
}
