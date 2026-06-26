-- Wings Nails App — Initial Schema
-- Generated from SQLModel models (backend/app/models.py)
-- Compatible with Supabase PostgreSQL

-- Cliente
CREATE TABLE IF NOT EXISTS cliente (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR NOT NULL,
    apellido VARCHAR NOT NULL,
    dni VARCHAR UNIQUE NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cantidad_turnos_tomados INTEGER NOT NULL DEFAULT 0,
    cantidad_turnos_abonados INTEGER NOT NULL DEFAULT 0,
    cantidad_turnos_cancelados_vencidos INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cliente_search ON cliente (nombre, apellido);

-- ClienteTelefono
CREATE TABLE IF NOT EXISTS clientetelefono (
    id SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL REFERENCES cliente(id),
    telefono VARCHAR NOT NULL,
    etiqueta VARCHAR(100),
    es_principal BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_ct_telefono ON clientetelefono (telefono);

-- Servicio
CREATE TABLE IF NOT EXISTS servicio (
    id SERIAL PRIMARY KEY,
    nombre_servicio VARCHAR NOT NULL,
    duracion_minutos INTEGER NOT NULL,
    precio_actual DOUBLE PRECISION NOT NULL,
    monto_sena_actual DOUBLE PRECISION NOT NULL,
    descripcion VARCHAR NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- Cita
CREATE TABLE IF NOT EXISTS cita (
    id SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL REFERENCES cliente(id),
    fecha_hora_cita TIMESTAMPTZ NOT NULL,
    precio_historico_cobrado DOUBLE PRECISION NOT NULL,
    sena_historica_pagada DOUBLE PRECISION NOT NULL,
    comprobante_transferencia_url VARCHAR,
    comprobante_verificado_manual BOOLEAN NOT NULL DEFAULT FALSE,
    monto_recibido_en_caja DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    estado_cita VARCHAR NOT NULL DEFAULT 'Pendiente',
    metodo_pago_sena VARCHAR NOT NULL DEFAULT 'Transferencia',
    fecha_registro_cita TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CitaServicio (composite PK)
CREATE TABLE IF NOT EXISTS citaservicio (
    cita_id INTEGER NOT NULL REFERENCES cita(id),
    servicio_id INTEGER NOT NULL REFERENCES servicio(id),
    duracion_minutos INTEGER NOT NULL,
    precio_unitario DOUBLE PRECISION NOT NULL,
    subtotal DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (cita_id, servicio_id)
);

-- HorarioSemanal
CREATE TABLE IF NOT EXISTS horariosemanal (
    id SERIAL PRIMARY KEY,
    dia_semana INTEGER UNIQUE NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT FALSE,
    hora_apertura VARCHAR NOT NULL DEFAULT '09:00',
    hora_cierre VARCHAR NOT NULL DEFAULT '18:00'
);

-- ExcepcionHorario
CREATE TABLE IF NOT EXISTS excepcionhorario (
    id SERIAL PRIMARY KEY,
    fecha DATE UNIQUE NOT NULL,
    cerrado BOOLEAN NOT NULL DEFAULT FALSE,
    hora_apertura VARCHAR,
    hora_cierre VARCHAR
);

-- Configuracion
CREATE TABLE IF NOT EXISTS configuracion (
    id SERIAL PRIMARY KEY,
    business_name VARCHAR NOT NULL DEFAULT 'Nails Studio',
    facebook_url VARCHAR NOT NULL DEFAULT '',
    instagram_url VARCHAR NOT NULL DEFAULT '',
    whatsapp_number VARCHAR NOT NULL DEFAULT '',
    address VARCHAR NOT NULL DEFAULT 'Rosario, Santa Fe',
    cbu_alias VARCHAR NOT NULL DEFAULT '',
    cbu_number VARCHAR NOT NULL DEFAULT ''
);

-- Usuario
CREATE TABLE IF NOT EXISTS usuario (
    id SERIAL PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    hashed_password VARCHAR NOT NULL,
    role VARCHAR NOT NULL DEFAULT 'admin',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usuario_email ON usuario (email);
