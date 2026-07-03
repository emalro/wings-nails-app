import os
import logging
from pathlib import Path
from sqlmodel import SQLModel, create_engine, Session

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")

# Supabase uses postgres:// but SQLAlchemy 2.0 requires postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

logger.info(f"Database URL scheme: {DATABASE_URL.split('://')[0] if '://' in DATABASE_URL else 'unknown'}")

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

try:
    engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)
except Exception as e:
    logger.error(f"Failed to create database engine: {e}")
    raise


def create_db_and_tables():
    from .models import Cliente, ClienteTelefono, Servicio, Cita, CitaServicio, Configuracion, HorarioSemanal, ExcepcionHorario, Usuario, GalleryItem

    # Non-destructive: CREATE TABLE IF NOT EXISTS for every model, so newly
    # added table=True classes (e.g. GalleryItem) materialize on next
    # startup with no manual migration. run_migration() handles ALTERs.
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
