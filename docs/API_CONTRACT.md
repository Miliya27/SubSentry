# SubSentry API Contract

**Base URL:** `/api/v1`  
**Content-Type:** `application/json`  
**Authentication:** Bearer JWT (except `/auth/login`, `/auth/register`, `/health`)  
**Version:** 1.0.0

---

## 1. Response Conventions

### 1.1 Success Envelope
```json
{
  "success": true,
  "data": { ... }
}
```
For paginated lists:
```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "total": 100,
    "page": 1,
    "size": 20,
    "pages": 5
  }
}
```

### 1.2 Error Envelope
Every error response MUST use this shape:
```json
{
  "success": false,
  "error": {
    "code": "STRING_SNAKE_CASE",
    "message": "Human-readable explanation",
    "details": null | { ... } | [ ... ]
  }
}
```

#### Standard Error Codes
| HTTP | Code | Meaning |
|------|------|---------|
| 400 | `VALIDATION_ERROR` | Request body / query param failed validation |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Valid token but insufficient permissions |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Duplicate resource (e.g., duplicate email) |
| 422 | `UNPROCESSABLE` | Semantic validation failed |
| 500 | `INTERNAL_ERROR` | Unhandled server error |

---

## 2. Authentication

### POST `/auth/register`
Register a new customer user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "StrongPass1!",
  "full_name": "Jane Doe",
  "phone": "+919876543210"
}
```
**Response 201:**
```json
{ "success": true, "data": { "id": 1, "email": "user@example.com", "role": "customer" } }
```
**Errors:** `CONFLICT` (email taken), `VALIDATION_ERROR`

---

### POST `/auth/login`
**Request:**
```json
{ "username": "user@example.com", "password": "StrongPass1!" }
```
(form-encoded for OAuth2PasswordRequestForm compatibility)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "access_token": "<jwt>",
    "token_type": "bearer",
    "expires_in": 1800
  }
}
```
**Errors:** `UNAUTHORIZED` (bad credentials)

---

### POST `/auth/forgot-password`
**Request:** `{ "email": "user@example.com" }`  
**Response 200:** `{ "success": true, "data": { "message": "Reset email sent if address is registered." } }`

---

### POST `/auth/reset-password`
**Request:** `{ "token": "<reset_token>", "new_password": "NewPass1!" }`  
**Response 200:** `{ "success": true, "data": { "message": "Password reset successfully." } }`  
**Errors:** `NOT_FOUND`, `UNPROCESSABLE` (expired token)

---

## 3. Users

### GET `/users/me`
Returns current user profile.  
**Response 200:** User object (see schema below).

---

### PATCH `/users/me`
Update current user profile fields.  
**Request:** `{ "full_name": "...", "phone": "..." }`  
**Response 200:** Updated user object.

---

### GET `/users` *(admin/staff)*
Paginated list of all users.  
**Query:** `page=1&size=20&role=customer`  
**Response 200:** Paginated user list.

---

### GET `/users/{user_id}` *(admin/staff)*
**Response 200:** User object.  
**Errors:** `NOT_FOUND`

---

### PATCH `/users/{user_id}` *(admin)*
Update any user (role, active status).  
**Errors:** `NOT_FOUND`, `FORBIDDEN`

---

### DELETE `/users/{user_id}` *(admin)*
Soft-delete or deactivate user.  
**Response 200:** `{ "success": true, "data": { "message": "User deactivated." } }`

---

## 4. Customers

### GET `/customers` *(admin/staff)*
### GET `/customers/{customer_id}` *(admin/staff)*
### PATCH `/customers/{customer_id}` *(admin/staff)*
### DELETE `/customers/{customer_id}` *(admin)*

Customer object fields: `id`, `user_id`, `company_name`, `gstin`, `billing_address`, `shipping_address`, `credit_limit`, `outstanding_balance`, `created_at`.

---

## 5. Products & Variants

### GET `/products`
### POST `/products` *(admin/staff)*
### GET `/products/{product_id}`
### PATCH `/products/{product_id}` *(admin/staff)*
### DELETE `/products/{product_id}` *(admin)*

Product fields: `id`, `name`, `description`, `unit`, `hsn_code`, `is_active`, `created_at`, `variants`.

### POST `/products/{product_id}/variants` *(admin/staff)*
### PATCH `/products/{product_id}/variants/{variant_id}` *(admin/staff)*
### DELETE `/products/{product_id}/variants/{variant_id}` *(admin)*

Variant fields: `id`, `product_id`, `name`, `brand`, `sku`, `price_override`, `attributes`, `is_active`.

---

## 6. Plans

### GET `/plans`
### POST `/plans` *(admin)*
### GET `/plans/{plan_id}`
### PATCH `/plans/{plan_id}` *(admin)*
### DELETE `/plans/{plan_id}` *(admin)*

Plan fields: `id`, `name`, `billing_cycle` (`monthly|yearly|weekly`), `price`, `trial_days`, `is_active`, `created_at`.

---

## 7. Tax Rules

### GET `/tax-rules` *(admin/staff)*
### POST `/tax-rules` *(admin)*
### PATCH `/tax-rules/{rule_id}` *(admin)*
### DELETE `/tax-rules/{rule_id}` *(admin)*

Fields: `id`, `name`, `rate` (Decimal percentage), `applies_to` (`all|product|hsn`), `hsn_code`, `is_active`.

---

## 8. Discount Rules

### GET `/discount-rules` *(admin/staff)*
### POST `/discount-rules` *(admin)*
### PATCH `/discount-rules/{rule_id}` *(admin)*
### DELETE `/discount-rules/{rule_id}` *(admin)*

Fields: `id`, `name`, `type` (`percentage|flat`), `value`, `min_amount`, `max_uses`, `uses_count`, `valid_from`, `valid_until`, `is_active`.

---

## 9. Quotation Templates

### GET `/quotation-templates` *(admin/staff)*
### POST `/quotation-templates` *(admin/staff)*
### GET `/quotation-templates/{template_id}`
### PATCH `/quotation-templates/{template_id}` *(admin/staff)*
### DELETE `/quotation-templates/{template_id}` *(admin)*

Fields: `id`, `name`, `customer_id`, `status` (`draft|sent|accepted|rejected`), `valid_until`, `notes`, `lines`, `created_at`.

Line fields: `id`, `template_id`, `product_variant_id`, `description`, `quantity`, `unit_price`, `discount`, `tax_rule_id`, `line_total`.

---

## 10. Subscriptions

### GET `/subscriptions` *(admin/staff)*
### POST `/subscriptions` *(admin/staff)*
### GET `/subscriptions/{subscription_id}`
### PATCH `/subscriptions/{subscription_id}` *(admin/staff)*
### POST `/subscriptions/{subscription_id}/cancel` *(admin/staff)*
### POST `/subscriptions/{subscription_id}/pause` *(admin/staff)*
### POST `/subscriptions/{subscription_id}/resume` *(admin/staff)*

Subscription fields: `id`, `customer_id`, `plan_id`, `product_variant_id`, `status` (`trial|active|paused|cancelled|expired`), `start_date`, `trial_end_date`, `next_billing_date`, `cancelled_at`, `lines`, `created_at`.

Subscription line fields: `id`, `subscription_id`, `product_variant_id`, `quantity`, `unit_price`, `discount`, `tax_rule_id`.

---

## 11. Invoices

### GET `/invoices` *(admin/staff)*
### POST `/invoices` *(admin/staff)*
### GET `/invoices/{invoice_id}`
### PATCH `/invoices/{invoice_id}` *(admin/staff)*
### POST `/invoices/{invoice_id}/send` *(admin/staff)*

Invoice fields: `id`, `subscription_id`, `customer_id`, `invoice_number`, `status` (`draft|sent|paid|overdue|void`), `issue_date`, `due_date`, `period_start`, `period_end`, `subtotal`, `tax_amount`, `discount_amount`, `total`, `notes`, `lines`, `created_at`.

Invoice line fields: `id`, `invoice_id`, `product_variant_id`, `description`, `quantity`, `unit_price`, `discount`, `tax_rule_id`, `line_total`.

Unique constraint: `(subscription_id, period_start)`.

---

## 12. Payments

### GET `/payments` *(admin/staff)*
### POST `/payments` *(admin/staff)*
### GET `/payments/{payment_id}`

Payment fields: `id`, `invoice_id`, `customer_id`, `amount`, `payment_date`, `method` (`cash|bank_transfer|upi|card|cheque`), `reference`, `notes`, `created_at`.

---

## 13. Audit Logs

### GET `/audit-logs` *(admin)*

Fields: `id`, `user_id`, `action`, `entity_type`, `entity_id`, `changes`, `ip_address`, `created_at`.

---

## 14. Health

### GET `/health`
Public. No auth required.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "1.0.0",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

---

## 15. Data Schemas

### User Object
```json
{
  "id": 1,
  "email": "admin@subsentry.com",
  "full_name": "Admin User",
  "phone": "+919876543210",
  "role": "admin",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Roles
`admin | staff | customer`

### Money
All money fields are strings in JSON (Decimal serialization), e.g. `"1234.50"`. Stored as `NUMERIC(12,2)` in DB.

---

## 16. Pagination Query Params
`page` (int, default 1), `size` (int, default 20, max 100).

## 17. Sorting / Filtering
Endpoints accept `sort_by` and `sort_dir` (`asc|desc`) where applicable. Filtering via field-specific query params documented per endpoint.
