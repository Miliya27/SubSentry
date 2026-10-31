/**
 * src/services/auth.ts
 * Real authentication API calls wired to backend endpoints defined in docs/API_CONTRACT.md:
 * - POST /auth/register
 * - POST /auth/login
 * - GET  /auth/me
 * - POST /auth/forgot-password
 * - POST /auth/reset-password
 */
import api from './api';
import type {
  ApiResponse,
  User,
  LoginCredentials,
  LoginResponse,
  RegisterData,
  RegisterResponse,
} from '../types';

export const authService = {
  /**
   * Register a new customer account
   * POST /auth/register
   */
  async register(data: RegisterData): Promise<RegisterResponse> {
    const res = await api.post<ApiResponse<RegisterResponse>>('/auth/register', data);
    return res.data.data!;
  },

  /**
   * Log in with email & password to obtain JWT access token
   * POST /auth/login
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const res = await api.post<ApiResponse<LoginResponse>>('/auth/login', credentials);
    return res.data.data!;
  },

  /**
   * Get current authenticated user profile
   * GET /auth/me
   */
  async getMe(): Promise<User> {
    const res = await api.get<ApiResponse<User>>('/auth/me');
    const user = res.data.data!;
    // Set fallback name alias for UI components expecting user.name
    if (!user.name && user.full_name) {
      user.name = user.full_name;
    }
    return user;
  },

  /**
   * Request password reset email
   * POST /auth/forgot-password
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const res = await api.post<ApiResponse<{ message: string }>>(
      '/auth/forgot-password',
      { email }
    );
    return res.data.data!;
  },

  /**
   * Set new password using token from email
   * POST /auth/reset-password
   */
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const res = await api.post<ApiResponse<{ message: string }>>(
      '/auth/reset-password',
      {
        token,
        new_password: newPassword,
      }
    );
    return res.data.data!;
  },
};

export default authService;
