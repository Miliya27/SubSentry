# SubSentry API Contract

> **Single source of truth for frontend and backend.**  
> Both members must agree before changing any URL, field name, enum value, or response shape.  
> See [§ Changing This Contract](#changing-this-contract).

**Version:** 1.1.0  
**Base URL:** `http://localhost:8000/api/v1`  
**Content-Type:** `application/json`

---

## Table of Contents

1. [Auth Header](#1-auth-header)
2. [Response Envelopes](#2-response-envelopes)
3. [Error Codes](#3-error-codes)
4. [Global Conventions](#4-global-conventions)
5. [Enums](#5-enums)
6. [State Machines](#6-state-machines)
7. [Seeded Demo Accounts](#7-seeded-demo-accounts)
8. [Endpoints](#8-endpoints)
   - [Auth](#81-auth)
   - [Users](#82-users)
   - [Customers](#83-customers)
   - [Products & Variants](#84-products--variants)
   - [Plans](#85-plans)
   - [Quotation Templates](#86-quotation-templates)
   - [Subscriptions](#87-subscriptions)
   - [Billing](#88-billing)
   - [Invoices](#89-invoices)
   - [Taxes](#810-taxes)
   - [Discounts](#811-discounts)
   - [Payments](#812-payments)
   - [Dashboard](#813-dashboard)
   - [Reports](#814-reports)
   - [Health](#815-health)
9. [Model Reconciliation Notes](#9-model-reconciliation-notes)
10. [Changing This Contract](#10-changing-this-contract)

---

## 1. Auth Header

All protected endpoints require:

```
Authorization: Bearer <access_token>
```

Public endpoints (no header required): `POST /auth/register`, `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /health`.

---

## 2. Response Envelopes

### 2.1 Success — single object

```json
{
  "success": true,
  "data": { },
  "message": "OK"
}
```

### 2.2 Success — paginated list

```json
{
  "success": true,
  "data": [ ],
  "message": "OK",
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 134
  }
}
```

`meta` is **only** present on list responses.

### 2.3 Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Password must contain an uppercase letter",
    "details": [
      {
        "field": "password",
        "message": "At least one uppercase letter required"
      }
    ]
  }
}
```

`details` is `null` for non-validation errors, or an array of `{field, message}` objects for `VALIDATION_ERROR`.

---

## 3. Error Codes

| HTTP | Code | Meaning |
|------|------|---------|
| 422 | `VALIDATION_ERROR` | Request body / query param failed schema or business validation |
| 401 | `UNAUTHENTICATED` | Missing, expired, or malformed token |
| 403 | `FORBIDDEN` | Valid token but insufficient role |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Duplicate resource (e.g. email already registered) |
| 400 | `BUSINESS_RULE` | Semantic rule violated (e.g. paying more than outstanding) |
| 500 | `INTERNAL_ERROR` | Unhandled server error |

---

## 4. Global Conventions

| Topic | Rule |
|---|---|
| **Money** | Always a **JSON string** with exactly 2 decimal places: `"2560.00"` |
| **Dates** | `YYYY-MM-DD` string |
| **Timestamps** | ISO-8601 UTC: `"2026-11-01T06:30:00Z"` |
| **Pagination** | Query params: `page` (default `1`), `page_size` (default `20`, max `100`) |
| **Filtering** | `q` (search), `status`, `sort` (field name), `sort_dir` (`asc`\|`desc`) |
| **IDs** | Integers |
| **Booleans** | JSON `true`/`false` |
| **Empty optional** | `null`, never omitted |

---

## 5. Enums

| Enum | Values |
|---|---|
| `role` | `admin` \| `staff` \| `customer` |
| `billing_frequency` | `daily` \| `weekly` \| `monthly` \| `yearly` |
| `subscription_status` | `draft` \| `quotation` \| `confirmed` \| `active` \| `paused` \| `closed` |
| `invoice_status` | `draft` \| `confirmed` \| `paid` \| `cancelled` |
| `payment_method` | `cash` \| `bank_transfer` \| `card` \| `upi` \| `cheque` |
| `discount_type` | `fixed` \| `percent` |
| `tax_applies_to` | `all` \| `product` \| `hsn` |

---

## 6. State Machines

### 6.1 Subscription Status

```
draft ──send-quotation──▶ quotation ──confirm──▶ confirmed ──activate──▶ active
                                                                        │      │
                                                                     pause   close
                                                                        │      │
                                                                     paused  closed
                                                                        │
                                                                     resume
                                                                        │
                                                                      active
```

| Current | Action | Next | Guard |
|---|---|---|---|
| `draft` | `send-quotation` | `quotation` | — |
| `quotation` | `confirm` | `confirmed` | — |
| `confirmed` | `activate` | `active` | Sets `next_billing_date` |
| `active` | `pause` | `paused` | `plan.allow_pause = true` |
| `paused` | `resume` | `active` | `plan.allow_pause = true` |
| `active` \| `paused` | `close` | `closed` | `plan.allow_early_close = true` or natural expiry |
| `active` | `renew` | `active` | `plan.allow_renewal = true`; extends `expiry_date` |

Terminal states: **`closed`**

### 6.2 Invoice Status

```
draft ──confirm──▶ confirmed ──(payment recorded)──▶ paid
  │                    │
cancel              cancel
  │                    │
cancelled           cancelled
```

| Current | Action | Next | Guard |
|---|---|---|---|
| `draft` | `confirm` | `confirmed` | — |
| `draft` \| `confirmed` | `cancel` | `cancelled` | No payments must exist on `confirmed` |
| `confirmed` | payment recorded = full amount | `paid` | Auto-transition in payment service |
| `confirmed` \| `paid` | `send` | — | Emails PDF (no status change) |

Terminal states: **`paid`**, **`cancelled`**

---

## 7. Seeded Demo Accounts

| Role | Email | Password |
|---|---|---|
| admin | admin@subsentry.com | Admin@1234 |
| staff | staff@subsentry.com | Staff@1234 |
| customer | customer@subsentry.com | Customer@1234 |

---

## 8. Endpoints

> **Key:** ✅ required field / body  |  ❓ optional  |  🔒 auth required  |  🌐 public

---

### 8.1 Auth

---

#### POST `/auth/register` 🌐

Create a new customer account.

**Request body:**
```json
{
  "full_name": "Riya Nair",
  "email": "riya@acme.in",
  "password": "Strong@123"
}
```

| Field | Type | Rules |
|---|---|---|
| `full_name` ✅ | string | 1–255 chars |
| `email` ✅ | string | valid RFC 5322 email |
| `password` ✅ | string | min 9 chars; ≥1 uppercase; ≥1 lowercase; ≥1 special character |

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": 7,
    "email": "riya@acme.in",
    "role": "customer"
  },
  "message": "Account created"
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| 409 | `CONFLICT` | Email already registered |
| 422 | `VALIDATION_ERROR` | Invalid email or weak password |

---

#### POST `/auth/login` 🌐

Exchange credentials for a JWT access token.

**Request body** (JSON):
```json
{
  "email": "admin@subsentry.com",
  "password": "Admin@1234"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "access_token": "<jwt>",
    "token_type": "bearer",
    "expires_in": 1800
  },
  "message": "OK"
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Bad credentials or inactive account |

---

#### GET `/auth/me` 🔒 any role

Returns the currently authenticated user's profile.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "admin@subsentry.com",
    "full_name": "Super Admin",
    "phone": "+910000000001",
    "role": "admin",
    "is_active": true,
    "created_at": "2026-10-31T04:00:00Z"
  },
  "message": "OK"
}
```

---

#### POST `/auth/forgot-password` 🌐

Trigger a password reset email. Always returns 200 (to prevent user enumeration).

**Request body:**
```json
{ "email": "riya@acme.in" }
```

**Response 200:**
```json
{
  "success": true,
  "data": { "message": "If that address is registered you will receive a reset link." },
  "message": "OK"
}
```

---

#### POST `/auth/reset-password` 🌐

Set a new password using the token from the reset email.

**Request body:**
```json
{
  "token": "<reset_token>",
  "new_password": "NewPass@99"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": { "message": "Password updated successfully." },
  "message": "OK"
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| 404 | `NOT_FOUND` | Token not found |
| 400 | `BUSINESS_RULE` | Token expired or already used |
| 422 | `VALIDATION_ERROR` | Weak password |

---

### 8.2 Users

---

#### POST `/users/staff` 🔒 admin

Create a staff user account.

**Request body:**
```json
{
  "full_name": "Priya Iyer",
  "email": "priya@subsentry.com",
  "password": "Staff@9999",
  "phone": "+919876543000"
}
```

**Response 201:** User object (same as `GET /auth/me` shape)

**Errors:** 409 `CONFLICT`, 422 `VALIDATION_ERROR`, 403 `FORBIDDEN`

---

#### GET `/users` 🔒 admin

Paginated list of all users.

**Query params:**
- `page`, `page_size`
- `role` — filter by `admin|staff|customer`
- `q` — search on `email`, `full_name`
- `sort` — `created_at` (default) | `email` | `full_name`
- `sort_dir` — `asc|desc`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "email": "admin@subsentry.com",
      "full_name": "Super Admin",
      "phone": "+910000000001",
      "role": "admin",
      "is_active": true,
      "created_at": "2026-10-31T04:00:00Z"
    }
  ],
  "message": "OK",
  "meta": { "page": 1, "page_size": 20, "total": 3 }
}
```

---

### 8.3 Customers

---

#### GET `/customers` 🔒 admin, staff

Paginated list.

**Query params:** `page`, `page_size`, `q` (searches `company_name`, `user.email`, `gstin`), `sort`, `sort_dir`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 3,
      "company_name": "Acme Pvt Ltd",
      "gstin": "29ABCDE1234F1Z5",
      "billing_address": "123 MG Road, Bengaluru",
      "shipping_address": null,
      "credit_limit": "50000.00",
      "outstanding_balance": "12500.00",
      "created_at": "2026-10-31T04:00:00Z",
      "user": {
        "id": 3,
        "email": "customer@subsentry.com",
        "full_name": "Demo Customer",
        "phone": "+910000000003"
      }
    }
  ],
  "message": "OK",
  "meta": { "page": 1, "page_size": 20, "total": 1 }
}
```

---

#### POST `/customers` 🔒 admin, staff

Create a customer profile for an existing user.

**Request body:**
```json
{
  "user_id": 3,
  "company_name": "Acme Pvt Ltd",
  "gstin": "29ABCDE1234F1Z5",
  "billing_address": "123 MG Road, Bengaluru",
  "shipping_address": null,
  "credit_limit": "50000.00"
}
```

**Response 201:** Customer object (as above)

**Errors:** 404 `NOT_FOUND` (user), 409 `CONFLICT` (customer already exists for user)

---

#### GET `/customers/{id}` 🔒 admin, staff; customer (own only)

**Response 200:** Single customer object (same shape as list item)

**Errors:** 404 `NOT_FOUND`, 403 `FORBIDDEN` (customer accessing another's record)

---

#### PUT `/customers/{id}` 🔒 admin, staff; customer (own only, limited fields)

**Request body** (all fields optional):
```json
{
  "company_name": "Acme Global",
  "gstin": "29ABCDE1234F1Z5",
  "billing_address": "456 Park Street, Mumbai",
  "shipping_address": "456 Park Street, Mumbai",
  "credit_limit": "75000.00"
}
```

> Customers may only update `billing_address`, `shipping_address`. Admin/staff may update all fields.

**Response 200:** Updated customer object

---

### 8.4 Products & Variants

---

#### GET `/products` 🔒 any auth

**Query params:** `page`, `page_size`, `q`, `is_active` (`true|false`)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "ERP Software License",
      "product_type": "software",
      "sales_price": "2000.00",
      "cost_price": "0.00",
      "description": "Enterprise resource planning software subscription",
      "unit": "license",
      "hsn_code": "998314",
      "notes": "Main license",
      "is_active": true,
      "created_at": "2026-10-31T04:00:00Z",
      "variants": [
        {
          "id": 1,
          "product_id": 1,
          "attribute": "Edition",
          "value": "Standard",
          "extra_price": "0.00",
          "sku": "ERP-STD-001",
          "is_active": true
        },
        {
          "id": 2,
          "product_id": 1,
          "attribute": "Brand",
          "value": "Odoo",
          "extra_price": "560.00",
          "sku": "ERP-ODOO-001",
          "is_active": true
        }
      ]
    }
  ],
  "message": "OK",
  "meta": { "page": 1, "page_size": 20, "total": 1 }
}
```

---

#### POST `/products` 🔒 admin

**Request body:**
```json
{
  "name": "ERP Software License",
  "product_type": "software",
  "sales_price": "2000.00",
  "cost_price": "0.00",
  "notes": "Main license",
  "description": "Enterprise resource planning software subscription",
  "unit": "license",
  "hsn_code": "998314"
}
```

| Field | Type | Rules |
|---|---|---|
| `name` ✅ | string | 1–255 chars |
| `product_type` ❓ | enum | `service|software|addon`, default `software` |
| `sales_price` ❓ | string/number | numeric, ≥ 0.00, default `0.00` |
| `cost_price` ❓ | string/number | numeric, ≥ 0.00, default `0.00` |
| `notes` ❓ | string|null | optional notes |
| `description` ❓ | string|null | optional extra |
| `unit` ❓ | string|null | max 50 chars |
| `hsn_code` ❓ | string|null | max 20 chars |

**Response 201:** Product object (variants array empty initially)

**Errors:** 422 `VALIDATION_ERROR`, 403 `FORBIDDEN`

---

#### GET `/products/{id}` 🔒 any auth

**Response 200:** Single product with variants

**Errors:** 404 `NOT_FOUND`

---

#### PUT `/products/{id}` 🔒 admin

**Request body** (all fields optional): same fields as POST plus `is_active` (boolean)

**Response 200:** Updated product object

---

#### DELETE `/products/{id}` 🔒 admin

Soft-delete (sets `is_active = false`).

**Response 200:**
```json
{ "success": true, "data": { "message": "Product deactivated." }, "message": "OK" }
```

**Errors:** 404 `NOT_FOUND`, 400 `BUSINESS_RULE` (active subscriptions reference this product)

---

#### GET `/products/{id}/variants` 🔒 any auth

**Response 200:** Array of variant objects (no `meta`)

---

#### POST `/products/{id}/variants` 🔒 admin

**Request body:**
```json
{
  "attribute": "Brand",
  "value": "Odoo",
  "extra_price": "560.00",
  "sku": "ERP-ODOO-001"
}
```

| Field | Type | Rules |
|---|---|---|
| `attribute` ✅ | string | 1–100 chars (e.g. `Brand`) |
| `value` ✅ | string | 1–100 chars (e.g. `Odoo`) |
| `extra_price` ❓ | string/number | numeric, ≥ 0.00, default `0.00` |
| `sku` ❓ | string|null | unique when provided, max 100 chars |

**Response 201:** Variant object

**Errors:** 409 `CONFLICT` (duplicate SKU), 404 `NOT_FOUND` (product)

---

#### PUT `/variants/{id}` 🔒 admin

Update a variant. All body fields optional (same as POST) plus `is_active` (boolean).

**Response 200:** Updated variant object

---

#### DELETE `/variants/{id}` 🔒 admin

Soft-delete variant (`is_active = false`).

**Response 200:**
```json
{ "success": true, "data": { "message": "Variant deactivated." }, "message": "OK" }
```

---

#### GET `/products/{id}/price` 🔒 any auth

Compute the final per-unit price for a product + optional variant.
Final price = `product.sales_price + variant.extra_price` (e.g. 2000.00 + 560.00 = 2560.00).

**Query params:**
- `variant_id` ❓ integer

**Response 200:**
```json
{
  "success": true,
  "data": {
    "product_id": 1,
    "variant_id": 2,
    "sales_price": "2000.00",
    "extra_price": "560.00",
    "final_price": "2560.00"
  },
  "message": "OK"
}
```

---

### 8.5 Plans

---

#### GET `/plans` 🔒 any auth

**Query params:** `page`, `page_size`, `q`, `billing_frequency`, `is_active`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Pro Monthly",
      "product_id": 1,
      "price": "2999.00",
      "billing_frequency": "monthly",
      "min_quantity": 1,
      "trial_days": 14,
      "available_from": "2026-11-01",
      "available_until": null,
      "auto_close_days": null,
      "allow_early_close": true,
      "allow_pause": true,
      "allow_renewal": true,
      "is_active": true,
      "created_at": "2026-10-31T04:00:00Z"
    }
  ],
  "message": "OK",
  "meta": { "page": 1, "page_size": 20, "total": 3 }
}
```

---

#### POST `/plans` 🔒 admin

**Request body:**
```json
{
  "name": "Pro Monthly",
  "product_id": 1,
  "price": "2000.00",
  "billing_frequency": "monthly",
  "min_quantity": 1,
  "trial_days": 0,
  "available_from": "2026-11-01",
  "available_until": null,
  "auto_close_days": null,
  "allow_early_close": true,
  "allow_pause": true,
  "allow_renewal": true
}
```

| Field | Type | Rules |
|---|---|---|
| `name` ✅ | string | 1–255 chars |
| `product_id` ✅ | integer | must exist |
| `price` ✅ | string | numeric, > 0 |
| `billing_frequency` ✅ | enum | `daily\|weekly\|monthly\|yearly` |
| `min_quantity` ✅ | integer | ≥ 1 |
| `trial_days` ❓ | integer | ≥ 0, default 0 |
| `available_from` ❓ | date | — |
| `available_until` ❓ | date | must be ≥ `available_from` if set |
| `auto_close_days` ❓ | integer\|null | ≥ 1 |
| `allow_early_close` ❓ | boolean | default `true` |
| `allow_pause` ❓ | boolean | default `true` |
| `allow_renewal` ❓ | boolean | default `true` |

**Response 201:** Plan object

**Errors:**
- 422 `VALIDATION_ERROR` — `available_until < available_from` or `min_quantity < 1`
- 403 `FORBIDDEN` — non-admin
- 404 `NOT_FOUND` — `product_id` does not exist

---

#### PUT `/plans/{id}` 🔒 admin

All fields optional (same as POST). Returns updated plan.

**Errors:** 404 `NOT_FOUND`, 403 `FORBIDDEN`

---

#### DELETE `/plans/{id}` 🔒 admin

Soft-delete plan.

**Response 200:**
```json
{ "success": true, "data": { "message": "Plan deactivated." }, "message": "OK" }
```

**Errors:** 400 `BUSINESS_RULE` (active subscriptions on plan)

---

### 8.6 Quotation Templates

---

#### GET `/quotation-templates` 🔒 admin, staff

**Query params:** `page`, `page_size`, `q`, `customer_id`, `status`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Standard Odoo Quotation",
      "customer_id": 1,
      "status": "draft",
      "valid_until": "2026-12-31",
      "notes": null,
      "created_at": "2026-10-31T04:00:00Z",
      "lines": []
    }
  ],
  "message": "OK",
  "meta": { "page": 1, "page_size": 20, "total": 1 }
}
```

---

#### POST `/quotation-templates` 🔒 admin, staff

**Request body:**
```json
{
  "name": "Standard Odoo Quotation",
  "customer_id": 1,
  "valid_until": "2026-12-31",
  "notes": "Includes Odoo variant",
  "lines": [
    {
      "product_variant_id": 2,
      "description": "Odoo ERP – 5 users",
      "quantity": "5.00",
      "unit_price": "3559.00",
      "discount": "0.00",
      "tax_rule_id": 1
    }
  ]
}
```

**Response 201:** Template object with lines

---

#### GET `/quotation-templates/{id}` 🔒 admin, staff

**Response 200:** Single template with lines

---

#### PUT `/quotation-templates/{id}` 🔒 admin, staff

Partial update. `lines` replaces all existing lines if provided.

**Response 200:** Updated template

---

#### DELETE `/quotation-templates/{id}` 🔒 admin, staff

**Response 200:**
```json
{ "success": true, "data": { "message": "Template deleted." }, "message": "OK" }
```

---

### 8.7 Subscriptions

---

#### GET `/subscriptions` 🔒 admin, staff (all); customer (own only)

**Query params:** `page`, `page_size`, `status`, `customer_id`, `plan_id`, `q`, `sort`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "customer_id": 1,
      "plan_id": 1,
      "product_variant_id": 2,
      "status": "draft",
      "start_date": "2026-11-01",
      "expiry_date": "2027-10-31",
      "payment_terms_days": 15,
      "next_billing_date": null,
      "cancelled_at": null,
      "created_at": "2026-10-31T04:00:00Z",
      "lines": [
        {
          "id": 1,
          "product_variant_id": 2,
          "quantity": "5.00",
          "unit_price": "3559.00",
          "discount": "0.00",
          "tax_rule_id": 1,
          "line_total": "17795.00"
        }
      ],
      "total": "21017.10"
    }
  ],
  "message": "OK",
  "meta": { "page": 1, "page_size": 20, "total": 1 }
}
```

---

#### POST `/subscriptions` 🔒 admin, staff

Create a new subscription in `draft` status.

**Request body:**
```json
{
  "customer_id": 3,
  "plan_id": 2,
  "product_variant_id": 2,
  "start_date": "2026-11-01",
  "expiry_date": "2027-10-31",
  "payment_terms_days": 15,
  "lines": [
    {
      "product_variant_id": 2,
      "quantity": 5,
      "tax_rule_id": 1
    }
  ]
}
```

| Field | Type | Rules |
|---|---|---|
| `customer_id` ✅ | integer | must exist |
| `plan_id` ✅ | integer | must exist and be active on `start_date` |
| `product_variant_id` ❓ | integer | header variant for the subscription |
| `start_date` ✅ | date | — |
| `expiry_date` ❓ | date | must be > `start_date` |
| `payment_terms_days` ❓ | integer | ≥ 0, default 0 |
| `lines` ✅ | array | at least 1 line |
| `lines[].product_variant_id` ✅ | integer | must exist |
| `lines[].quantity` ✅ | integer | ≥ `plan.min_quantity` |
| `lines[].tax_rule_id` ❓ | integer | must exist |

The server computes `unit_price` from `plan.price + variant.price_override` and `line_total`. Status is always `"draft"` on creation.

**Response 201:** Subscription object with computed `unit_price`, `line_total`, `total`

**Errors:**
- 422 `VALIDATION_ERROR` — quantity < `plan.min_quantity`
- 400 `BUSINESS_RULE` — plan not available on `start_date`
- 404 `NOT_FOUND` — customer, plan, or variant not found

---

#### POST `/subscriptions/from-template` 🔒 admin, staff

Create a subscription (draft) populated from a quotation template.

**Request body:**
```json
{
  "template_id": 1,
  "customer_id": 1,
  "plan_id": 2,
  "start_date": "2026-11-01",
  "expiry_date": "2027-10-31",
  "payment_terms_days": 15
}
```

**Response 201:** Subscription object

**Errors:** 404 `NOT_FOUND` (template, customer, plan)

---

#### GET `/subscriptions/{id}` 🔒 role-scoped

Admin/staff: any. Customer: own only.

**Response 200:** Single subscription object with lines

---

#### PUT `/subscriptions/{id}` 🔒 role-scoped

Editable only when `status = draft`. Fields: `start_date`, `expiry_date`, `payment_terms_days`, `lines`.

**Response 200:** Updated subscription

**Errors:** 400 `BUSINESS_RULE` (non-draft), 404 `NOT_FOUND`

---

#### POST `/subscriptions/{id}/send-quotation` 🔒 admin, staff

Transition `draft → quotation`.

**Request body:** `{}` (empty or omitted)

**Response 200:**
```json
{ "success": true, "data": { "id": 1, "status": "quotation" }, "message": "Quotation sent." }
```

**Errors:** 400 `BUSINESS_RULE` (not in `draft`)

---

#### POST `/subscriptions/{id}/confirm` 🔒 admin, staff

Transition `quotation → confirmed`.

**Response 200:**
```json
{ "success": true, "data": { "id": 1, "status": "confirmed" }, "message": "Subscription confirmed." }
```

**Errors:** 400 `BUSINESS_RULE` (not in `quotation`)

---

#### POST `/subscriptions/{id}/activate` 🔒 admin, staff

Transition `confirmed → active`. Sets `next_billing_date`.

**Response 200:**
```json
{
  "success": true,
  "data": { "id": 1, "status": "active", "next_billing_date": "2026-12-01" },
  "message": "Subscription activated."
}
```

**Errors:** 400 `BUSINESS_RULE` (not in `confirmed`)

---

#### POST `/subscriptions/{id}/pause` 🔒 admin, staff

Transition `active → paused`. Requires `plan.allow_pause = true`.

**Response 200:**
```json
{ "success": true, "data": { "id": 1, "status": "paused" }, "message": "Subscription paused." }
```

**Errors:** 400 `BUSINESS_RULE` (plan does not allow pause, or not active)

---

#### POST `/subscriptions/{id}/resume` 🔒 admin, staff

Transition `paused → active`.

**Response 200:**
```json
{ "success": true, "data": { "id": 1, "status": "active" }, "message": "Subscription resumed." }
```

**Errors:** 400 `BUSINESS_RULE` (not paused, or plan does not allow pause)

---

#### POST `/subscriptions/{id}/renew` 🔒 admin, staff

Extend `expiry_date` by one billing cycle. Requires `plan.allow_renewal = true`.

**Response 200:**
```json
{ "success": true, "data": { "id": 1, "status": "active", "expiry_date": "2028-10-31" }, "message": "Subscription renewed." }
```

**Errors:** 400 `BUSINESS_RULE` (not active or renewal not allowed)

---

#### POST `/subscriptions/{id}/close` 🔒 admin, staff

Transition `active|paused → closed`.

**Response 200:**
```json
{ "success": true, "data": { "id": 1, "status": "closed", "cancelled_at": "2026-11-15T10:00:00Z" }, "message": "Subscription closed." }
```

**Errors:** 400 `BUSINESS_RULE` (already closed or `allow_early_close = false` before `expiry_date`)

---

### 8.8 Billing

---

#### POST `/billing/run` 🔒 admin

Run billing for all active subscriptions with `next_billing_date ≤ as_of_date`.

**Request body:**
```json
{ "as_of_date": "2026-12-01" }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "created": 42,
    "skipped": 3,
    "failed": 0,
    "invoice_ids": [101, 102, 103],
    "errors": []
  },
  "message": "Billing run complete."
}
```

**Errors:** 403 `FORBIDDEN`

---

#### GET `/billing/preview` 🔒 admin

Dry-run — shows which invoices *would* be created without committing.

**Query params:**
- `as_of` ✅ — date (`YYYY-MM-DD`)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "would_create": 42,
    "would_skip": 3,
    "subscriptions": [
      { "id": 1, "customer_id": 1, "next_billing_date": "2026-12-01", "total": "21017.10" }
    ]
  },
  "message": "OK"
}
```

---

### 8.9 Invoices

---

#### GET `/invoices` 🔒 admin, staff (all); customer (own only)

**Query params:** `page`, `page_size`, `status`, `customer_id`, `subscription_id`, `from` (date), `to` (date), `sort`, `sort_dir`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "subscription_id": 1,
      "customer_id": 1,
      "invoice_number": "INV-2026-0001",
      "status": "confirmed",
      "issue_date": "2026-11-01",
      "due_date": "2026-11-16",
      "period_start": "2026-11-01",
      "period_end": "2026-11-30",
      "subtotal": "17795.00",
      "tax_amount": "3203.10",
      "discount_amount": "0.00",
      "total": "21017.10",
      "amount_paid": "0.00",
      "outstanding": "21017.10",
      "notes": null,
      "created_at": "2026-11-01T04:00:00Z"
    }
  ],
  "message": "OK",
  "meta": { "page": 1, "page_size": 20, "total": 1 }
}
```

---

#### GET `/invoices/{id}` 🔒 role-scoped

Full invoice including lines and payments.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "invoice_number": "INV-2026-0001",
    "status": "confirmed",
    "issue_date": "2026-11-01",
    "due_date": "2026-11-16",
    "period_start": "2026-11-01",
    "period_end": "2026-11-30",
    "subtotal": "17795.00",
    "tax_amount": "3203.10",
    "discount_amount": "0.00",
    "total": "21017.10",
    "amount_paid": "0.00",
    "outstanding": "21017.10",
    "notes": null,
    "lines": [
      {
        "id": 1,
        "product_variant_id": 2,
        "description": "Odoo ERP – 5 users",
        "quantity": "5.00",
        "unit_price": "3559.00",
        "discount": "0.00",
        "tax_rule_id": 1,
        "line_total": "17795.00"
      }
    ],
    "payments": [],
    "created_at": "2026-11-01T04:00:00Z"
  },
  "message": "OK"
}
```

---

#### POST `/invoices/{id}/confirm` 🔒 admin, staff

Transition `draft → confirmed`.

**Response 200:**
```json
{ "success": true, "data": { "id": 1, "status": "confirmed" }, "message": "Invoice confirmed." }
```

**Errors:** 400 `BUSINESS_RULE` (not in `draft`)

---

#### POST `/invoices/{id}/cancel` 🔒 admin, staff

Transition `draft|confirmed → cancelled`. Cannot cancel a paid invoice.

**Response 200:**
```json
{ "success": true, "data": { "id": 1, "status": "cancelled" }, "message": "Invoice cancelled." }
```

**Errors:** 400 `BUSINESS_RULE` (already paid)

---

#### POST `/invoices/{id}/send` 🔒 admin, staff

Email the invoice PDF to the customer. Does not change status.

**Response 200:**
```json
{ "success": true, "data": { "message": "Invoice emailed to customer@subsentry.com." }, "message": "OK" }
```

**Errors:** 400 `BUSINESS_RULE` (invoice is `draft` — must confirm first)

---

#### GET `/invoices/{id}/print` 🔒 role-scoped

Returns all data needed to render a print-ready invoice (for PDF generation on the frontend).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "invoice": { },
    "customer": { },
    "lines": [ ],
    "payments": [ ],
    "tax_breakdown": [
      { "name": "GST 18%", "rate": "18.00", "taxable_amount": "17795.00", "tax": "3203.10" }
    ]
  },
  "message": "OK"
}
```

---

### 8.10 Taxes

---

#### GET `/taxes` 🔒 any auth

**Query params:** `page`, `page_size`, `q`, `is_active`, `is_default`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "GST 18%",
      "rate_percent": "18.00",
      "rate": "18.00",
      "is_default": true,
      "is_active": true,
      "applies_to": "all",
      "hsn_code": null
    }
  ],
  "message": "OK",
  "meta": { "page": 1, "page_size": 20, "total": 1 }
}
```

---

#### POST `/taxes` 🔒 admin

**Request body:**
```json
{
  "name": "GST 18%",
  "rate_percent": "18.00",
  "is_default": true
}
```

| Field | Type | Rules |
|---|---|---|
| `name` ✅ | string | 1–100 chars |
| `rate_percent` ✅ | string/number | 0.00–100.00 (or `rate` for backwards compatibility) |
| `is_default` ❓ | boolean | default `false` |
| `applies_to` ❓ | enum | `all|product|hsn`, default `all` |
| `hsn_code` ❓ | string|null | required when `applies_to = hsn` |

**Response 201:** Tax rule object

---

#### PUT `/taxes/{id}` 🔒 admin

All fields optional (same as POST) plus `is_active` (boolean). Returns updated tax rule.

---

#### DELETE `/taxes/{id}` 🔒 admin

Soft-delete (`is_active = false`).

**Response 200:**
```json
{ "success": true, "data": { "message": "Tax rule deactivated." }, "message": "OK" }
```

---

### 8.11 Discounts

---

#### GET `/discounts` 🔒 admin

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "New Customer 10%",
      "type": "percent",
      "value": "10.00",
      "min_amount": "0.00",
      "max_uses": 100,
      "uses_count": 12,
      "valid_from": "2026-11-01",
      "valid_until": "2026-12-31",
      "is_active": true
    }
  ],
  "message": "OK",
  "meta": { "page": 1, "page_size": 20, "total": 1 }
}
```

---

#### POST `/discounts` 🔒 admin

**Request body:**
```json
{
  "name": "New Customer 10%",
  "type": "percent",
  "value": "10.00",
  "min_amount": "0.00",
  "max_uses": 100,
  "valid_from": "2026-11-01",
  "valid_until": "2026-12-31"
}
```

| Field | Type | Rules |
|---|---|---|
| `name` ✅ | string | 1–100 chars |
| `type` ✅ | enum | `fixed\|percent` |
| `value` ✅ | string | > 0; if `percent`, ≤ 100 |
| `min_amount` ❓ | string | ≥ 0, default `"0.00"` |
| `max_uses` ❓ | integer\|null | ≥ 1 |
| `valid_from` ❓ | date | — |
| `valid_until` ❓ | date | must be ≥ `valid_from` |

**Response 201:** Discount object

---

#### PUT `/discounts/{id}` 🔒 admin

All fields optional. Returns updated discount.

---

#### DELETE `/discounts/{id}` 🔒 admin

Soft-delete.

**Response 200:**
```json
{ "success": true, "data": { "message": "Discount deactivated." }, "message": "OK" }
```

---

### 8.12 Payments

---

#### POST `/invoices/{id}/payments` 🔒 admin, staff

Record a payment against an invoice.

**Request body:**
```json
{
  "method": "bank_transfer",
  "amount": "5000.00",
  "payment_date": "2026-12-03",
  "reference": "UTR 8841",
  "notes": "Partial payment"
}
```

| Field | Type | Rules |
|---|---|---|
| `method` ✅ | enum | `cash\|bank_transfer\|card\|upi\|cheque` |
| `amount` ✅ | string | > 0; ≤ invoice outstanding |
| `payment_date` ✅ | date | — |
| `reference` ❓ | string | — |
| `notes` ❓ | string | — |

**Response 201:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": 1,
      "invoice_id": 1,
      "customer_id": 1,
      "amount": "5000.00",
      "payment_date": "2026-12-03",
      "method": "bank_transfer",
      "reference": "UTR 8841",
      "notes": "Partial payment",
      "created_at": "2026-12-03T10:00:00Z"
    },
    "invoice": {
      "id": 1,
      "status": "confirmed",
      "total": "21017.10",
      "amount_paid": "5000.00",
      "outstanding": "16017.10"
    }
  },
  "message": "Payment recorded."
}
```

**Errors:**
- 400 `BUSINESS_RULE` — invoice not `confirmed`; amount ≤ 0; amount > outstanding

---

#### GET `/payments` 🔒 admin, staff

**Query params:** `page`, `page_size`, `customer_id`, `invoice_id`, `method`, `from` (date), `to` (date)

**Response 200:** Paginated list of payment objects

---

### 8.13 Dashboard

---

#### GET `/dashboard/summary` 🔒 admin, staff

**Query params:** `from` ❓ (date), `to` ❓ (date)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "active_subscriptions": 1032,
    "revenue_received": "845000.00",
    "total_invoiced": "990000.00",
    "outstanding": "145000.00",
    "overdue_count": 18,
    "overdue_amount": "61000.00",
    "mrr": "310000.00",
    "arr": "3720000.00"
  },
  "message": "OK"
}
```

---

#### GET `/dashboard/revenue-trend` 🔒 admin, staff

**Query params:** `months` ❓ integer (default 6)

**Response 200:**
```json
{
  "success": true,
  "data": [
    { "month": "2026-06", "invoiced": "150000.00", "received": "130000.00" },
    { "month": "2026-07", "invoiced": "165000.00", "received": "145000.00" }
  ],
  "message": "OK"
}
```

---

#### GET `/dashboard/plan-distribution` 🔒 admin, staff

**Response 200:**
```json
{
  "success": true,
  "data": [
    { "plan_id": 1, "plan_name": "Pro Monthly", "count": 420, "percentage": "40.70" },
    { "plan_id": 2, "plan_name": "Pro Yearly", "count": 612, "percentage": "59.30" }
  ],
  "message": "OK"
}
```

---

#### GET `/dashboard/upcoming-renewals` 🔒 admin, staff

**Query params:** `days` ❓ integer (default 30)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "subscription_id": 5,
      "customer_id": 2,
      "customer_name": "Globe Corp",
      "plan_name": "Pro Yearly",
      "next_billing_date": "2026-12-01",
      "total": "35990.00"
    }
  ],
  "message": "OK"
}
```

---

#### GET `/dashboard/customer` 🔒 customer (own only)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "active_subscriptions": 2,
    "total_invoiced": "42034.20",
    "amount_paid": "21017.10",
    "outstanding": "21017.10",
    "next_renewal": "2026-12-01"
  },
  "message": "OK"
}
```

---

### 8.14 Reports

---

#### GET `/reports/revenue` 🔒 admin, staff

**Query params:**
- `from` ✅ — date
- `to` ✅ — date
- `group_by` ❓ — `day|week|month` (default `month`)

**Response 200:**
```json
{
  "success": true,
  "data": [
    { "period": "2026-11", "invoiced": "990000.00", "received": "845000.00", "outstanding": "145000.00" }
  ],
  "message": "OK"
}
```

---

#### GET `/reports/invoices.csv` 🔒 admin, staff

CSV export of invoices. Same filter params as `GET /invoices`.

**Response 200:** `Content-Type: text/csv`

```
invoice_number,status,customer,issue_date,due_date,total,amount_paid,outstanding
INV-2026-0001,confirmed,Demo Customer,2026-11-01,2026-11-16,21017.10,0.00,21017.10
```

---

### 8.15 Health

---

#### GET `/health` 🌐

Public health check. No auth required.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "1.0.0",
    "timestamp": "2026-10-31T04:00:00Z"
  },
  "message": "OK"
}
```

---

## 9. Model Reconciliation Notes

> **For Miliya (backend):** The following discrepancies exist between the Hour 1 models and this contract. The models must be updated before implementing the routes.

| Field / Enum | Current Model | This Contract | Action |
|---|---|---|---|
| `subscription_status` | `trial\|active\|paused\|cancelled\|expired` | `draft\|quotation\|confirmed\|active\|paused\|closed` | Update `SubscriptionStatusEnum` + default |
| `invoice_status` | `draft\|sent\|paid\|overdue\|void` | `draft\|confirmed\|paid\|cancelled` | Update `InvoiceStatusEnum` |
| `Plan.billing_cycle` (field name) | `billing_cycle` | `billing_frequency` | Rename column / field |
| `billing_frequency` values | `monthly\|yearly\|weekly` | `daily\|weekly\|monthly\|yearly` | Add `daily`, rename enum |
| `discount_type` values | `percentage\|flat` | `fixed\|percent` | Update `DiscountTypeEnum` |
| Plan missing fields | — | `product_id`, `min_quantity`, `available_from`, `available_until`, `auto_close_days`, `allow_early_close`, `allow_pause`, `allow_renewal` | Add columns to `plans` table |
| Subscription missing fields | — | `expiry_date`, `payment_terms_days` | Add columns to `subscriptions` table |
| `subscription_lines.unit_price` | present | computed on creation | OK as-is |

---

## 10. Changing This Contract

> **Any change to a URL, field name, enum value, HTTP status code, or response shape requires explicit agreement from both Miliya (backend) and Aswin (frontend) before implementation.**

Process:
1. Author proposes a diff against this file in the PR description.
2. Both members review and comment on GitHub.
3. Merge only after explicit approval from both.
4. Bump the version number at the top of this file.
