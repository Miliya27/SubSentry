# SubSentry

Subscription management platform — FastAPI backend + React/Vite frontend.

---

## Seed Credentials

| Role     | Email                      | Password        |
|----------|----------------------------|-----------------|
| admin    | admin@subsentry.com        | Admin@1234      |
| staff    | staff@subsentry.com        | Staff@1234      |
| customer | customer@subsentry.com     | Customer@1234   |

---

## Backend – Quick Start

Requires **Python 3.11+**.

```bash
cd backend

# 1. Create and activate virtual environment
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
copy .env.example .env         # Windows
# cp .env.example .env         # macOS / Linux
# Edit .env – at minimum set a real SECRET_KEY

# 4. Run the development server
uvicorn app.main:app --reload

# 5. Seed the database (safe to run multiple times)
python scripts/seed.py
```

### API Docs
- Swagger UI: http://localhost:8000/docs
- ReDoc:       http://localhost:8000/redoc
- Health:      http://localhost:8000/api/v1/health

### Run tests
```bash
pytest tests/ -v
```

---

## Frontend – Quick Start

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## Project Structure

```
SubSentry/
├── backend/
│   ├── app/
│   │   ├── core/        # config.py (pydantic-settings)
│   │   ├── database/    # session.py (engine, SessionLocal, Base, get_db)
│   │   ├── models/      # SQLAlchemy ORM models
│   │   ├── routes/      # FastAPI routers (added per stage)
│   │   ├── schemas/     # Pydantic request/response schemas
│   │   └── services/    # Business logic
│   ├── scripts/
│   │   └── seed.py      # Idempotent DB seed
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
├── frontend/            # React + Vite + TypeScript + Tailwind
└── docs/
    └── API_CONTRACT.md  # Single source of truth for API shapes
```
