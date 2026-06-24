from __future__ import annotations
from datetime import date, datetime, timezone
from enum import Enum
from typing import List, Optional
from sqlmodel import Field, SQLModel, Index


class EstadoCita(str, Enum):
    pendiente = "Pendiente"
    confirmado = "Confirmado"
    asistido = "Asistido"
    cancelado_cliente = "Cancelado_Cliente"
    cancelado_vencimiento = "Cancelado_Sistema_Vencimiento"


class ClienteBase(SQLModel):
    nombre: str
    apellido: str
    dni: str = Field(unique=True)
    activo: bool = True


class Cliente(ClienteBase, table=True):
    __table_args__ = (
        Index("idx_cliente_search", "nombre", "apellido"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    fecha_creacion: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    cantidad_turnos_tomados: int = Field(default=0)
    cantidad_turnos_abonados: int = Field(default=0)
    cantidad_turnos_cancelados_vencidos: int = Field(default=0)
    # Relationship fields removed for simpler ORM mapping in initial prototype


class ClienteTelefono(SQLModel, table=True):
    __table_args__ = (Index("idx_ct_telefono", "telefono"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    id_cliente: int = Field(foreign_key="cliente.id")
    telefono: str
    etiqueta: Optional[str] = Field(default=None, max_length=100)
    es_principal: bool = False


class ServicioBase(SQLModel):
    nombre_servicio: str
    duracion_minutos: int
    precio_actual: float
    monto_sena_actual: float
    descripcion: str
    activo: bool = True


class Servicio(ServicioBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    # Relationship fields removed for simpler ORM mapping in initial prototype


class CitaBase(SQLModel):
    fecha_hora_cita: datetime
    precio_historico_cobrado: float
    sena_historica_pagada: float
    comprobante_transferencia_url: Optional[str] = None
    comprobante_verificado_manual: bool = Field(default=False)
    monto_recibido_en_caja: float = Field(default=0.0)
    estado_cita: EstadoCita = Field(default=EstadoCita.pendiente)
    metodo_pago_sena: str = Field(default="Transferencia")


class Cita(CitaBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    id_cliente: int = Field(foreign_key="cliente.id")
    # Relationship fields removed for simpler ORM mapping in initial prototype
    fecha_registro_cita: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CitaServicio(SQLModel, table=True):
    cita_id: Optional[int] = Field(default=None, foreign_key="cita.id", primary_key=True)
    servicio_id: Optional[int] = Field(default=None, foreign_key="servicio.id", primary_key=True)
    duracion_minutos: int
    precio_unitario: float
    subtotal: float
    # Relationship fields removed for simpler ORM mapping in initial prototype


class HorarioSemanal(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    dia_semana: int = Field(unique=True)  # 0=Dom...6=Sáb
    activo: bool = Field(default=False)
    hora_apertura: str = Field(default="09:00")
    hora_cierre: str = Field(default="18:00")


class ExcepcionHorario(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    fecha: date = Field(unique=True)
    cerrado: bool = Field(default=False)
    hora_apertura: Optional[str] = Field(default=None)
    hora_cierre: Optional[str] = Field(default=None)


class Configuracion(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    business_name: str = Field(default="Nails Studio")
    facebook_url: str = Field(default="")
    instagram_url: str = Field(default="")
    whatsapp_number: str = Field(default="")
    address: str = Field(default="Rosario, Santa Fe")
    cbu_alias: str = Field(default="")
    cbu_number: str = Field(default="")


class Usuario(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    role: str = Field(default="admin")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
