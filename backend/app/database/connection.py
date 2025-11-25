"""
Supabase database connection and session management
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from supabase import create_client, Client
from typing import Generator
import os

from ..core.config import settings

# Supabase client for auth and realtime features
# Only create if Supabase is configured
supabase_client: Client | None = None
if settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY:
    try:
        # Try to create client, but handle version compatibility issues
        supabase_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_ANON_KEY
        )
    except TypeError as e:
        if "proxy" in str(e).lower():
            print(f"Warning: Supabase client version incompatibility: {e}")
            print("This may be due to httpx version mismatch. Continuing without Supabase (dev mode).")
            print("To fix: Update supabase and httpx to compatible versions.")
        else:
            print(f"Warning: Failed to initialize Supabase client: {e}")
        supabase_client = None
    except Exception as e:
        print(f"Warning: Failed to initialize Supabase client: {e}")
        print("Continuing without Supabase (dev mode)")
        supabase_client = None

# SQLAlchemy engine for database operations
# Use Supabase PostgreSQL if configured, otherwise SQLite for dev mode
if settings.SUPABASE_DATABASE_URL:
    DATABASE_URL = settings.SUPABASE_DATABASE_URL
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,  # Verify connections before using
        pool_size=5,
        max_overflow=10
    )
else:
    # Dev mode: use SQLite
    DATABASE_URL = "sqlite:///./dev.db"
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}  # SQLite requirement
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency for database sessions.

    Usage:
        @app.get("/items")
        def read_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables (use Alembic for migrations in production)"""
    from .models import Base
    Base.metadata.create_all(bind=engine)


def get_supabase() -> Client | None:
    """
    Get Supabase client instance.
    Returns None if Supabase is not configured.

    Usage:
        supabase = get_supabase()
        if supabase:
            user = supabase.auth.get_user(token)
    """
    return supabase_client
