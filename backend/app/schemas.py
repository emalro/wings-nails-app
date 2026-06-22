from __future__ import annotations
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from .models import EstadoCita


class ClienteCreate(BaseModel):
    nombre: str
    apellido: str
    telefono: str


class ClienteRead(ClienteCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    fecha_creacion: datetime
    cantidad_turnos_tomados: int
    cantidad_turnos_abonados: int
    cantidad_turnos_cancelados_vencidos: int


class ServicioCreate(BaseModel):
    nombre_servicio: str
    duracion_minutos: int
    precio_actual: float
    monto_sena_actual: float
    descripcion: str
    activo: Optional[bool] = True


class ServicioRead(ServicioCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int


class ServicioUpdate(BaseModel):
    nombre_servicio: Optional[str] = None
    duracion_minutos: Optional[int] = None
    precio_actual: Optional[float] = None
    monto_sena_actual: Optional[float] = None
    descripcion: Optional[str] = None
    activo: Optional[bool] = None


class CitaServicioCreate(BaseModel):
    servicio_id: int
    duracion_minutos: int
    precio_unitario: float
    subtotal: float


class CitaCreate(BaseModel):
    id_cliente: int
    fecha_hora_cita: datetime
    precio_historico_cobrado: float
    sena_historica_pagada: float
    metodo_pago_sena: Optional[str] = "Transferencia"
    servicios: List[CitaServicioCreate]


class CitaUpdate(BaseModel):
    estado_cita: Optional[EstadoCita] = None
    fecha_hora_cita: Optional[datetime] = None
    monto_recibido_en_caja: Optional[float] = None
    comprobante_verificado_manual: Optional[bool] = None
    precio_historico_cobrado: Optional[float] = None
    sena_historica_pagada: Optional[float] = None
    metodo_pago_sena: Optional[str] = None
    servicios: Optional[List[CitaServicioCreate]] = None


class ConfiguracionUpdate(BaseModel):
    business_name: Optional[str] = None
    facebook_url: Optional[str] = None
    instagram_url: Optional[str] = None
    whatsapp_number: Optional[str] = None
    address: Optional[str] = None


class ConfiguracionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    business_name: str
    facebook_url: str
    instagram_url: str
    whatsapp_number: str
    address: str


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
