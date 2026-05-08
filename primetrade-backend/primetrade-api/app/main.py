from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
import time
import logging

from app.core.config import settings
from app.api.v1 import api_router
from app.db.session import engine
from app.models.models import Base

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ─── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting PrimeTrade API...")
    # Create all tables on startup (use Alembic migrations in prod)
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables created/verified")
    yield
    logger.info("🛑 Shutting down PrimeTrade API...")


# ─── App Factory ──────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
## PrimeTrade REST API

A production-grade REST API with:
- **JWT Authentication** (access + refresh tokens)
- **Role-Based Access Control** (user / admin)
- **Task Management** CRUD with pagination & filtering
- **Soft Delete**, input validation, error handling
- **API Versioning** at `/api/v1`

### Auth Flow
1. `POST /api/v1/auth/register` → create account
2. `POST /api/v1/auth/login` → get tokens
3. Use `Authorization: Bearer <access_token>` on protected routes
4. `POST /api/v1/auth/refresh` → rotate tokens before expiry
    """,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ─── Middleware ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_timing_middleware(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start_time) * 1000
    response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"
    response.headers["X-API-Version"] = settings.APP_VERSION
    logger.info(
        f"{request.method} {request.url.path} → {response.status_code} [{duration_ms:.1f}ms]"
    )
    return response


# ─── Global Error Handlers ────────────────────────────────────────────────────
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": f"Route {request.url.path} not found", "error_code": "ROUTE_NOT_FOUND"},
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    logger.error(f"Internal error on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error", "error_code": "INTERNAL_ERROR"},
    )


# ─── Routes ───────────────────────────────────────────────────────────────────
app.include_router(api_router)


@app.get("/health", tags=["Health"], summary="Health check")
def health_check():
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/", tags=["Root"])
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "docs": "/docs",
        "version": settings.APP_VERSION,
    }
