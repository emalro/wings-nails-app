from __future__ import annotations
import re
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_serializer, field_validator, model_validator
from pydantic_core import PydanticCustomError
from .models import EstadoCita


def normalize_phone(phone: str) -> str:
    """Strip everything except digits. Reusable in validation AND search.

    A-17: the canonical wire format for telefono is digits-only. The
    frontend may collect formatted input ("+54 341 555-1234") but
    submission to the backend, search-by-phone, and storage all go
    through this single function so the format is consistent across
    the system.
    """
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
        # A-17: digits-only is the canonical wire format. Allow common
        # formatting chars (spaces, dashes, plus, parens) in the input
        # so users can paste a phone from their contacts, but normalize
        # to digits-only BEFORE the length check and before returning.
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

    @field_validator("fecha_hora_cita", mode="after")
    @classmethod
    def _accept_naive_or_aware(cls, v):
        return v.replace(tzinfo=None) if v.tzinfo else v


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

    @field_validator("fecha_hora_cita", mode="after")
    @classmethod
    def _accept_naive_or_aware(cls, v):
        return v.replace(tzinfo=None) if v.tzinfo else v


class ConfiguracionUpdate(BaseModel):
    business_name: Optional[str] = None
    facebook_url: Optional[str] = None
    instagram_url: Optional[str] = None
    whatsapp_number: Optional[str] = None
    address: Optional[str] = None
    cbu_alias: Optional[str] = None
    cbu_number: Optional[str] = None
    sobre_mi: Optional[str] = None


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
    sobre_mi: str


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


# ── Public booking schemas (REQ-PUB-001..005) ─────────────────────────────
# Used by the unauthenticated POST /public/clients and POST /public/appointments
# endpoints. extra="forbid" is critical: a public caller must NOT be able to
# sneak in `id_cliente` (REQ-PUB-003) or `estado_cita` (REQ-PUB-004).
# The `honeypot` field is declared here for documentation but has NO validator
# (D2): the route is responsible for the silent-200 check so the response
# shape is identical to a real success and gives the bot no signal.

class PublicClientLookupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    dni: str = Field(min_length=7, max_length=8, pattern=r"^\d+$")
    nombre: str = Field(min_length=1, max_length=100)
    apellido: str = Field(min_length=1, max_length=100)
    telefono: str
    email: Optional[str] = Field(default=None, max_length=200)
    # No validator — silent-200 is a route concern (design D2).
    honeypot: str = Field(default="", max_length=500)

    @field_validator("telefono")
    @classmethod
    def _normalize_telefono(cls, v: str) -> str:
        # Reuse the canonical digits-only normalizer (REQ-PUB-001: phone >=7 digits).
        digits = normalize_phone(v)
        if len(digits) < 7:
            raise ValueError("Teléfono: debe tener al menos 7 dígitos")
        return digits


class PublicClientLookupResponse(BaseModel):
    id: int
    was_existing: bool


class PublicCitaServicioCreate(BaseModel):
    servicio_id: int
    duracion_minutos: int = Field(gt=0)
    precio_unitario: float = Field(ge=0)
    subtotal: float = Field(ge=0)


class PublicAppointmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    dni: str = Field(min_length=7, max_length=8, pattern=r"^\d+$")
    servicios: List["PublicCitaServicioCreate"] = Field(min_length=1)
    fecha_hora_cita: datetime
    precio_historico_cobrado: float = Field(ge=0)
    sena_historica_pagada: float = Field(ge=0)
    # No validator — silent-200 is a route concern (design D2).
    honeypot: str = Field(default="", max_length=500)

    @field_validator("fecha_hora_cita", mode="after")
    @classmethod
    def _accept_naive_or_aware(cls, v: datetime) -> datetime:
        # REQ-DCO-005: normalize aware → naive so the value round-trips
        # through SQLite/PostgreSQL without tzinfo drift.
        return v.replace(tzinfo=None) if v.tzinfo else v

    @model_validator(mode="after")
    def check_sena_no_supera_precio(self):
        # REQ-DVA-001: sena must not exceed precio. Literal error type
        # `sena_excede_precio` (no ñ) — locked by test_post_appointments
        # _with_sena_mayor_returns_422_with_literal_type_sena.
        if self.sena_historica_pagada > self.precio_historico_cobrado:
            raise PydanticCustomError(
                "sena_excede_precio",
                "La seña ({sena}) no puede superar el precio de la cita ({precio})",
                {"sena": self.sena_historica_pagada, "precio": self.precio_historico_cobrado},
            )
        return self


class PublicAppointmentResponse(BaseModel):
    id: int
    fecha_hora_cita: datetime
    estado_cita: EstadoCita  # always "Pendiente" — hardcoded by the route (REQ-PUB-004)


# ── Testimonial schemas ──────────────────────────────────────────────────


class TestimonialRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    rol: Optional[str] = None
    quote: str
    activo: bool
    orden: int
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def _ser_dates(self, v: datetime) -> str:
        return _strip_tz(v)


class TestimonialCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    rol: Optional[str] = Field(default=None, max_length=100)
    quote: str = Field(min_length=1, max_length=500)
    activo: bool = True
    orden: int = Field(default=0)


class TestimonialUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=100)
    rol: Optional[str] = Field(default=None, max_length=100)
    quote: Optional[str] = Field(default=None, min_length=1, max_length=500)
    activo: Optional[bool] = None
    orden: Optional[int] = None


# ── home-gallery schemas (REQ-HMG-001..022) ─────────────────────────────────
#
# 3 schemas, not 4: Read + Create + Update. The "missing" 4th is a deliberate
# omission — there is no List/CreateWithImage/Upload/Replace schema. The admin
# pastes external URLs (REQ-HMG-051), there is no file-upload endpoint.
#
# Wire-format quirk note (R12): image_url and link_url use HttpUrl on Create /
# Update for the strict input validation (rejects file://, javascript:, data:,
# empty string, anything without a scheme). The ORM column is `str`, NOT
# HttpUrl — Pydantic v2's HttpUrl serializer appends a trailing slash on
# bare-hostnames (https://example.com → https://example.com/), which would
# mangle the admin's input on round-trip. By keeping the column as `str`, the
# stored value is the raw admin input and GalleryItemRead returns it as `str`
# without transformation.


class GalleryItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    orden: int
    image_url: str
    alt_text: str
    link_url: Optional[str] = None
    activo: bool
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def _ser_dates(self, v: datetime) -> str:
        return _strip_tz(v)


class GalleryItemCreate(BaseModel):
    orden: int = Field(ge=1, le=6)
    image_url: HttpUrl  # rejects file://, javascript:, data:, bare strings
    alt_text: str = Field(min_length=1, max_length=200)
    link_url: Optional[HttpUrl] = None
    activo: bool = False


class GalleryItemUpdate(BaseModel):
    """Partial update for /gallery/{id}. orden is intentionally excluded — the
    slot number is set on first create and stays. Use PATCH for field-level
    changes only; the route uses model_dump(exclude_unset=True) so omitted
    fields are left untouched in the DB.
    """
    image_url: Optional[HttpUrl] = None
    alt_text: Optional[str] = Field(default=None, min_length=1, max_length=200)
    link_url: Optional[HttpUrl] = None
    activo: Optional[bool] = None
