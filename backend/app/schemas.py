from __future__ import annotations
import re
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator
from pydantic_core import PydanticCustomError
from .models import EstadoCita


def normalize_phone(phone: str) -> str:
    """Strip everything except digits. Reusable in validation AND search."""
    return re.sub(r"\D", "", phone)


def _strip_tz(v: datetime) -> str:
    """Serialize datetime to ISO without tzinfo suffix (REQ-DCO-004).

    Pydantic v2's default datetime serializer appends `Z` to aware datetimes
    (e.g. those returned by PostgreSQL TIMESTAMP WITH TIME ZONE). That
    suffix causes JavaScript Date parsers in Argentina (UTC-3) to shift
    the wall-clock hour by 3. The system operates in a single timezone
    (Argentina), so wall-clock time is the only time that matters.
    Naive datetimes pass through unchanged.
    """
    return v.replace(tzinfo=None).isoformat() if v.tzinfo else v.isoformat()


class ClienteCreate(BaseModel):
    nombre: str
    apellido: str
    dni: str
    telefono: str

    @field_validator("telefono")
    @classmethod
    def validate_telefono(cls, v: str) -> str:
        clean = re.sub(r"[^\d\s\-\+\(\)]", "", v)
        if clean != v:
            raise ValueError("Teléfono: caracteres no válidos")
        digits = normalize_phone(v)
        if len(digits) < 7:
            raise ValueError("Teléfono: debe tener al menos 7 dígitos")
        return digits


class ClienteTelefonoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    id_cliente: int
    telefono: str
    etiqueta: Optional[str] = Field(default=None, max_length=100)
    es_principal: bool


class ClienteTelefonoCreate(BaseModel):
    telefono: str
    etiqueta: Optional[str] = Field(default=None, max_length=100)

    @field_validator("telefono")
    @classmethod
    def validate_telefono(cls, v: str) -> str:
        clean = re.sub(r"[^\d\s\-\+\(\)]", "", v)
        if clean != v:
            raise ValueError("Teléfono: caracteres no válidos")
        digits = normalize_phone(v)
        if len(digits) < 7:
            raise ValueError("Teléfono: debe tener al menos 7 dígitos")
        return digits


class ClienteTelefonoUpdate(BaseModel):
    etiqueta: Optional[str] = Field(default=None, max_length=100)
    es_principal: Optional[bool] = None


class ClienteUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    dni: Optional[str] = None


class ClienteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    apellido: str
    dni: str
    activo: bool
    fecha_creacion: datetime
    cantidad_turnos_tomados: int
    cantidad_turnos_abonados: int
    cantidad_turnos_cancelados_vencidos: int
    telefonos: list[ClienteTelefonoRead]

    @field_serializer("fecha_creacion")
    def _ser_fecha_creacion(self, v: datetime) -> str:
        return _strip_tz(v)


class ServicioCreate(BaseModel):
    nombre_servicio: str
    duracion_minutos: int
    precio_actual: float = Field(ge=0)
    monto_sena_actual: float = Field(ge=0)
    descripcion: str
    activo: Optional[bool] = True

    @model_validator(mode="after")
    def check_seña_no_supera_precio(self):
        if self.monto_sena_actual > self.precio_actual:
            raise PydanticCustomError(
                "seña_excede_precio",
                "La seña ({seña}) no puede superar el precio del servicio ({precio})",
                {"seña": self.monto_sena_actual, "precio": self.precio_actual},
            )
        return self


class ServicioRead(ServicioCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int


class ServicioUpdate(BaseModel):
    nombre_servicio: Optional[str] = None
    duracion_minutos: Optional[int] = None
    precio_actual: Optional[float] = Field(default=None, ge=0)
    monto_sena_actual: Optional[float] = Field(default=None, ge=0)
    descripcion: Optional[str] = None
    activo: Optional[bool] = None

    @model_validator(mode="after")
    def check_seña_no_supera_precio(self):
        # Only validate if both fields are explicitly set in this update.
        if self.monto_sena_actual is not None and self.precio_actual is not None:
            if self.monto_sena_actual > self.precio_actual:
                raise PydanticCustomError(
                    "seña_excede_precio",
                    "La seña ({seña}) no puede superar el precio del servicio ({precio})",
                    {"seña": self.monto_sena_actual, "precio": self.precio_actual},
                )
        return self


class CitaServicioCreate(BaseModel):
    servicio_id: int
    duracion_minutos: int
    precio_unitario: float
    subtotal: float


class CitaCreate(BaseModel):
    id_cliente: int
    fecha_hora_cita: datetime
    precio_historico_cobrado: float = Field(ge=0)
    sena_historica_pagada: float = Field(ge=0)
    metodo_pago_sena: Optional[str] = "Transferencia"
    estado_cita: Optional[EstadoCita] = None
    servicios: List[CitaServicioCreate]

    @model_validator(mode="after")
    def check_sena_no_supera_precio(self):
        if self.sena_historica_pagada > self.precio_historico_cobrado:
            raise PydanticCustomError(
                "sena_excede_precio",
                "La seña ({sena}) no puede superar el precio de la cita ({precio})",
                {"sena": self.sena_historica_pagada, "precio": self.precio_historico_cobrado},
            )
        return self


class CitaUpdate(BaseModel):
    estado_cita: Optional[EstadoCita] = None
    fecha_hora_cita: Optional[datetime] = None
    monto_recibido_en_caja: Optional[float] = Field(default=None, ge=0)
    comprobante_verificado_manual: Optional[bool] = None
    precio_historico_cobrado: Optional[float] = Field(default=None, ge=0)
    sena_historica_pagada: Optional[float] = Field(default=None, ge=0)
    metodo_pago_sena: Optional[str] = None
    servicios: Optional[List[CitaServicioCreate]] = None

    @model_validator(mode="after")
    def check_sena_no_supera_precio(self):
        if self.sena_historica_pagada is not None and self.precio_historico_cobrado is not None:
            if self.sena_historica_pagada > self.precio_historico_cobrado:
                raise PydanticCustomError(
                    "sena_excede_precio",
                    "La seña ({sena}) no puede superar el precio de la cita ({precio})",
                    {"sena": self.sena_historica_pagada, "precio": self.precio_historico_cobrado},
                )
        return self


class ConfiguracionUpdate(BaseModel):
    business_name: Optional[str] = None
    facebook_url: Optional[str] = None
    instagram_url: Optional[str] = None
    whatsapp_number: Optional[str] = None
    address: Optional[str] = None
    cbu_alias: Optional[str] = None
    cbu_number: Optional[str] = None


class ConfiguracionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    business_name: str
    facebook_url: str
    instagram_url: str
    whatsapp_number: str
    address: str
    cbu_alias: str
    cbu_number: str


class CitaServicioRead(BaseModel):
    servicio_id: int
    nombre_servicio: str
    duracion_minutos: int
    precio_unitario: float
    subtotal: float


class HorarioSemanalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    dia_semana: int
    activo: bool
    hora_apertura: str
    hora_cierre: str


class HorarioSemanalUpdate(BaseModel):
    dia_semana: int = Field(ge=0, le=6)
    activo: bool = False
    hora_apertura: str = Field(default="09:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    hora_cierre: str = Field(default="18:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")


class WeeklyScheduleBatchUpdate(BaseModel):
    items: List[HorarioSemanalUpdate]


class ExcepcionHorarioCreate(BaseModel):
    fecha: date
    cerrado: bool = False
    hora_apertura: Optional[str] = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    hora_cierre: Optional[str] = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")


class ExcepcionHorarioRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    fecha: date
    cerrado: bool
    hora_apertura: Optional[str] = None
    hora_cierre: Optional[str] = None


class EffectiveHoursResponse(BaseModel):
    abierto: bool
    hora_apertura: Optional[str] = None
    hora_cierre: Optional[str] = None


class CitaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    id_cliente: int
    cliente_nombre: Optional[str] = None
    fecha_hora_cita: datetime
    precio_historico_cobrado: float
    sena_historica_pagada: float
    comprobante_transferencia_url: Optional[str]
    comprobante_verificado_manual: bool
    monto_recibido_en_caja: float
    estado_cita: EstadoCita
    metodo_pago_sena: str
    fecha_registro_cita: datetime
    duracion_total_minutos: int = 0
    servicios: List[CitaServicioRead] = []

    @field_serializer("fecha_hora_cita", "fecha_registro_cita")
    def _ser_fechas(self, v: datetime) -> str:
        return _strip_tz(v)


# Auth schemas
class LoginRequest(BaseModel):
    email: str
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    email: str
    role: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UserRead
