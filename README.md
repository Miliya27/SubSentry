# SubSentry

SubSentry is a subscription management platform built during an 8-hour hackathon. It manages products, variants, recurring plans, taxes, discount rules, quotation templates, subscription lifecycles, automated billing runs, invoices, manual payments, and financial dashboard metrics.

---

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy 2.0 (declarative ORM), SQLite (PostgreSQL-ready), Pydantic v2, Python-Jose (JWT), Passlib (Bcrypt), Pytest.
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS.
- **API Standard**: RESTful endpoints with strict success (`{success: true, data, message, meta}`) and error (`{success: false, error: {code, message, details}}`) response envelopes. Monetary values are computed with `Decimal` and serialized as 2-decimal strings.

---

## Features

1. **Authentication & RBAC**: JWT access tokens, role-based access control (`admin`, `staff`, `customer`), password resets with expiring tokens.
2. **Catalog & Pricing**: Products, attribute-based variants (`sales_price + extra_price`), recurring plans (daily, weekly, monthly, yearly), and tax rules.
3. **Subscriptions & Lifecycle**: Quotation templates with configurable validity, automated `SUB-YYYY-NNNNN` numbering, explicit state machine transitions (`draft -> quotation -> confirmed -> active -> closed`, pause/resume, renewals), and customer-role query isolation.
4. **Discounts & Pricing Engine**: Strict `Decimal` half-up rounding order (`line_base -> best eligible discount -> taxable -> tax -> line_total`), usage-capped rules, and date-window eligibility.
5. **Billing Engine**: Automated period generation (daily, weekly, monthly with Jan 31 clamping, yearly), savepoint isolation per subscription, idempotency on `(subscription_id, period_start)`, and auto-closure on expiry.
6. **Invoices & Payments**: Sequential `INV-YYYY-NNNNN` draft generation, invoice confirmation with discount usage increment, email sending, print layout data, and manual payment recording with status transitions (`confirmed -> paid`).
7. **Dashboard & Financial Metrics**: Pure SQL aggregations for revenue received, total invoiced, outstanding balances, overdue tracking, MRR, ARR, customer account overview, and upcoming renewals.

---

## Architecture Summary

The backend follows a layered separation of concerns:
```
Routes  ──>  Schemas  ──>  Services  ──>  Models
 (API)     (Validation)    (Logic)      (ORM/DB)
```
- **Routes** (`app/routes/`): FastAPI routers handling HTTP requests, dependency injection, and role enforcement.
- **Schemas** (`app/schemas/`): Pydantic models for request validation and 2-decimal string serialization.
- **Services** (`app/services/`): Pure business logic:
  - `pricing.py`: Half-up decimal math, line calculation, and discount rule evaluation.
  - `subscriptions.py`: Unique sequence numbering and state machine lifecycle transitions.
  - `billing.py`: Period calculation, idempotency checks, and automated draft invoice creation.
  - `finance.py`: Central source of truth for payment status, overdue detection, MRR/ARR, and SQL dashboard metrics.
  - `mailer.py`: Email dispatcher supporting console logging and SMTP STARTTLS.
- **Models** (`app/models/`): SQLAlchemy declarative tables with performance indexes and foreign key constraints.

---

## Seed Credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@subsentry.com` | `Admin@1234` |
| Staff | `staff@subsentry.com` | `Staff@1234` |
| Customer | `customer@subsentry.com` | `Customer@1234` |

---

## Environment Variables

Configured in `backend/.env` (reference: `backend/.env.example`):

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy database connection string | `sqlite:///./subsentry.db` |
| `SECRET_KEY` | Secret key for signing JWT tokens | `insecure-dev-secret-change-in-production` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime in minutes | `30` |
| `FRONTEND_URL` | Allowed frontend origin | `http://localhost:5173` |
| `CORS_ORIGINS` | Comma-separated list of allowed CORS origins | `http://localhost:5173,http://localhost:3000` |
| `EMAIL_MODE` | Email output mode (`console` or `smtp`) | `console` |
| `SMTP_HOST` | SMTP server host | `""` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | `""` |
| `SMTP_PASSWORD` | SMTP password | `""` |
| `SMTP_FROM` | Outgoing sender email | `noreply@subsentry.com` |

---

## Setup & Running

### Backend

Requires **Python 3.11+**.

```bash
cd backend

# 1. Create and activate virtual environment
python -m venv venv
# Windows PowerShell:
venv\Scripts\Activate.ps1
# macOS / Linux:
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Environment configuration
copy .env.example .env    # Windows
# cp .env.example .env    # macOS / Linux

# 4. Seed database (idempotent, safe to run multiple times)
python scripts/seed.py

# 5. Start development server
uvicorn app.main:app --reload
```
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- Health check: `http://localhost:8000/api/v1/health`

### Frontend

```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`.

---

## Running the Automated Billing Demo

1. **Log in as Admin** via `POST /api/v1/auth/login` (`admin@subsentry.com` / `Admin@1234`) and copy the token into the Swagger UI Authorize dialog.
2. **Activate a Subscription**:
   - Create a subscription via `POST /api/v1/subscriptions` with `start_date` set to a past date (e.g. `2026-08-01`).
   - Transition through lifecycle:
     - `POST /api/v1/subscriptions/{id}/send-quotation`
     - `POST /api/v1/subscriptions/{id}/confirm`
     - `POST /api/v1/subscriptions/{id}/activate` (sets `next_billing_date = start_date`).
3. **Execute Billing Run**:
   - Call `POST /api/v1/billing/run` with `{"as_of_date": "2026-10-15"}`.
   - The engine generates invoices for all due periods (Aug, Sep, Oct) without skipping: returns `created: 3`.
4. **Verify Idempotency**:
   - Call `POST /api/v1/billing/run` again with `{"as_of_date": "2026-10-15"}`.
   - Returns `created: 0` because existing periods are detected and `next_billing_date` was advanced.

---

## Running Tests

Run the full pytest suite from the workspace root or `backend/`:

```bash
pytest backend/tests -v
```

All 97 unit and integration tests cover:
- Authentication, RBAC, and password resets
- Products, attribute variants, plans, and taxes
- Quotation templates and subscriptions lifecycle
- Pricing calculation order and worked tax/discount examples
- Billing engine period math, missed months, and savepoint rollbacks
- Payments, partial payments, full settlement, and overdue detection
- Dashboard SQL aggregations and role-based query isolation

---

## Known Limitations

- **Email Dispatch**: Password-reset and invoice emails print to the console under a `[DEV EMAIL]` banner unless `EMAIL_MODE=smtp` and SMTP credentials are provided.
- **Payment Processing**: There is no live payment gateway integration; payments are recorded manually via `POST /invoices/{id}/payments`.
- **Database Engine**: Uses SQLite locally with foreign key support enabled; database models and queries are PostgreSQL-ready.
- **Deferred Non-Essentials**: As scoped for the 8-hour sprint, CSV exports, historical charts (`revenue-trend`, `plan-distribution`), and the 1,000-row synthetic benchmark (`docs/PERFORMANCE.md`) are not implemented.
