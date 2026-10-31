/**
 * src/services/customers.ts
 * Real API calls for Customers management matching docs/API_CONTRACT.md (§8.3)
 */
import api from './api';
import type {
  ApiResponse,
  PaginatedResponse,
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  User,
} from '../types';

export const customersService = {
  /**
   * List paginated customers
   * GET /customers
   */
  async getCustomers(params?: {
    page?: number;
    page_size?: number;
    q?: string;
    sort?: string;
    sort_dir?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Customer>> {
    const res = await api.get<PaginatedResponse<Customer>>('/customers', {
      params,
    });
    return res.data;
  },

  /**
   * Get single customer by ID
   * GET /customers/{id}
   */
  async getCustomer(id: number | string): Promise<Customer> {
    const res = await api.get<ApiResponse<Customer>>(`/customers/${id}`);
    return res.data.data!;
  },

  /**
   * Create a customer profile
   * POST /customers
   */
  async createCustomer(data: CreateCustomerInput): Promise<Customer> {
    const res = await api.post<ApiResponse<Customer>>('/customers', data);
    return res.data.data!;
  },

  /**
   * Update customer profile
   * PUT /customers/{id}
   */
  async updateCustomer(
    id: number | string,
    data: UpdateCustomerInput
  ): Promise<Customer> {
    const res = await api.put<ApiResponse<Customer>>(`/customers/${id}`, data);
    return res.data.data!;
  },

  /**
   * Query users list (e.g. to link a user account to a customer profile)
   * GET /users
   */
  async getUsers(params?: {
    page?: number;
    page_size?: number;
    role?: string;
    q?: string;
  }): Promise<PaginatedResponse<User>> {
    const res = await api.get<PaginatedResponse<User>>('/users', {
      params,
    });
    return res.data;
  },
};

export default customersService;
