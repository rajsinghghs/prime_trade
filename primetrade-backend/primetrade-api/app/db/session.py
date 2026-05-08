from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from sqlalchemy.pool import QueuePool
from typing import Generator
from app.core.config import settings


engine = create_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,          # Detect stale connections
    pool_recycle=3600,           # Recycle connections every hour
    echo=settings.DEBUG,
)


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=Session,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


def get_db() -> Generator[Session, None, None]:
    """Dependency: yields a DB session and ensures cleanup."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
