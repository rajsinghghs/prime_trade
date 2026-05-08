# 🚀 PrimeTrade — Scalable REST API with Auth & RBAC

A production-grade backend built with **FastAPI + SQLAlchemy 2.0 + PostgreSQL**, with a modern **Vanilla JS** frontend.

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI 0.111, Python 3.12 |
| **ORM** | SQLAlchemy 2.0 (Mapped / DeclarativeBase) |
| **Database** | PostgreSQL 16 |
| **Auth** | JWT (access + refresh tokens), bcrypt |
| **Validation** | Pydantic v2 |
| **Frontend** | Vanilla JS (ES6+), CSS Custom Properties |
| **Docs** | Swagger UI (`/docs`), ReDoc (`/redoc`) |
| **DevOps** | Docker Compose |

---

## 🗂️ Project Structure

```
primetrade-api/
├── app/
│   ├── api/v1/endpoints/    # Route handlers (auth, tasks, admin)
│   ├── core/                # Config, security, dependencies
│   ├── db/                  # Database session & engine
│   ├── models/              # SQLAlchemy ORM models (class-based)
│   ├── schemas/             # Pydantic request/response schemas
│   ├── services/            # Business logic (AuthService, TaskService)
│   └── main.py              # App factory, middleware, error handlers
├── .env.example
├── alembic.ini
├── docker-compose.yml
├── Dockerfile
└── requirements.txt

primetrade-frontend/
├── css/style.css            # All styles, CSS variables, responsive
├── js/api.js                # API client (fetch wrapper + token store)
├── js/app.js                # SPA controller, UI logic
└── index.html
```

---

## ⚡ Quick Start

### Option A — Docker Compose (Recommended)

```bash
# Clone and navigate
git clone <repo-url> && cd primetrade-api

# Copy env
cp .env.example .env

# Start all services (PostgreSQL + Redis + API)
docker-compose up --build

# API available at http://localhost:8000
# Swagger UI at http://localhost:8000/docs
```

### Option B — Local Development

**Prerequisites:** Python 3.12+, PostgreSQL 16, (optional) Redis

```bash
# 1. Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# 4. Start PostgreSQL and create DB

# 5. Run the server (tables auto-created on startup)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

Open `primetrade-frontend/index.html` in a browser via Live Server (VS Code) or:

```bash
cd primetrade-frontend
python -m http.server 5500
# Open http://localhost:5500
```

> **Note:** Update `ALLOWED_ORIGINS` in `.env` to include your frontend origin.

---

## 🔑 API Overview

### Authentication — `/api/v1/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | ❌ | Register new user |
| POST | `/login` | ❌ | Login → returns JWT tokens |
| POST | `/refresh` | ❌ | Rotate tokens |
| GET | `/me` | ✅ | Current user profile |
| POST | `/logout` | ✅ | Logout |

### Tasks — `/api/v1/tasks`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | ✅ | Create task |
| GET | `/?page=1&page_size=10&status=todo&priority=high` | ✅ | List tasks (paginated, filterable) |
| GET | `/{id}` | ✅ | Get task |
| PATCH | `/{id}` | ✅ | Update task |
| DELETE | `/{id}` | ✅ | Soft-delete task |

### Admin — `/api/v1/admin` *(admin role only)*

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users` | 🔒 Admin | List all users |
| GET | `/users/{id}` | 🔒 Admin | Get user |
| PATCH | `/users/{id}` | 🔒 Admin | Update role / status |
| DELETE | `/users/{id}` | 🔒 Admin | Deactivate user |

---

## 🔐 Security Practices

- **bcrypt** password hashing via `passlib`
- **JWT access + refresh** token rotation (stateless, 30min / 7d)
- **First-user bootstrap**: first registered account gets admin role automatically
- **Constant-time password comparison** prevents timing attacks
- **Input sanitization** via Pydantic v2 validators
- **Password strength enforcement** (8+ chars, upper, lower, digit, symbol)
- **Soft delete** — records never permanently removed, preserving audit trail
- **CORS** configured per environment
- **HTTPBearer** dependency for clean token extraction

---

## 🗃️ Database Schema

```sql
-- users
CREATE TABLE users (
  id           VARCHAR(36) PRIMARY KEY,
  email        VARCHAR(255) UNIQUE NOT NULL,
  username     VARCHAR(50)  UNIQUE NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  full_name    VARCHAR(100),
  role         ENUM('user','admin') DEFAULT 'user',
  is_active    BOOLEAN DEFAULT TRUE,
  is_verified  BOOLEAN DEFAULT FALSE,
  last_login   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- tasks
CREATE TABLE tasks (
  id          VARCHAR(36) PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  status      ENUM('todo','in_progress','done') DEFAULT 'todo',
  priority    ENUM('low','medium','high','critical') DEFAULT 'medium',
  due_date    TIMESTAMPTZ,
  is_deleted  BOOLEAN DEFAULT FALSE,   -- soft delete
  owner_id    VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  INDEX ix_tasks_owner_status (owner_id, status),
  INDEX ix_tasks_owner_priority (owner_id, priority)
);
```

---

## 📈 Scalability Note

See [SCALABILITY.md](./SCALABILITY.md) for a full write-up.

**TL;DR:**
- Stateless JWT → horizontal API scaling with a load balancer
- SQLAlchemy connection pool (`pool_size=10, max_overflow=20`) + `pool_pre_ping`
- Redis for token blacklisting and response caching
- Modular service layer → easy extraction to microservices
- Docker Compose → Kubernetes-ready with minimal changes

---

## 📖 API Documentation

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **OpenAPI JSON:** http://localhost:8000/openapi.json
