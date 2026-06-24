import os
from pathlib import Path
from sqlmodel import SQLModel, create_engine, Session

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)


def create_db_and_tables():
    from .models import Cliente, ClienteTelefono, Servicio, Cita, CitaServicio, Configuracion, HorarioSemanal, ExcepcionHorario, Usuario

    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
