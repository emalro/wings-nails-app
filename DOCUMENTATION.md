# DOCUMENTATION.md

> Última actualización: 22/06/2026

## Propósito
Este documento captura el historial de cambios, decisiones de diseño y consideraciones de implementación del proyecto. Debe ser usado como el registro oficial del agente para documentar cada intervención.

## Formato de registro de cambios
Cada entrada de cambio debe incluir:
- Fecha
- Tipo de cambio (Nueva funcionalidad, Corrección, Mejora, Documentación, Infraestructura)
- Descripción breve
- Archivos afectados
- Requisitos relacionados
- Motivo / justificación
- Impacto esperado

> **Nota**: La autoría se determina por el historial de git. No incluir campo "Autor" en las entradas.

### Plantilla de entrada
```
Fecha: 2026-06-20
Tipo de cambio: Nueva funcionalidad
Descripción: Se creó AGENTS.md para definir las responsabilidades del agente y las reglas de documentación.
Archivos afectados: AGENTS.md, DOCUMENTATION.md
Requisitos relacionados: REQ-1 (uso de REQUIREMENTS.md como fuente agnóstica)
Motivo: Garantizar que todos los cambios queden registrados y mantener `REQUIREMENTS.md` libre de tecnología.
Impacto esperado: Mejora de la trazabilidad y mayor disciplina en el proceso de desarrollo.
```

## Reglas de uso
- Todo cambio realizado en el repositorio debe tener una entrada en este documento.
- Las decisiones de diseño y las suposiciones deben registrarse en secciones separadas si no son cambios directos de código.
- El documento debe mantenerse actualizado y legible.

## Secciones recomendadas
- Historial de cambios
- Decisiones de diseño (ARCHITECTURE DECISIONS)
- Suposiciones y aclaraciones
- Pendientes y riesgos

## Requisitos de documentación
- Registrarse antes de un cambio importante cuando se trate de una decisión de diseño o estructura.
- Registrar después del cambio para documentar el resultado final.
- Indicar claramente si un requisito fue cumplido o si requiere seguimiento.

---

## Historial de cambios

### 2026-06-20 — Inicial
- **Tipo**: Documentación
- **Descripción**: Se crearon los documentos base del proyecto: AGENTS.md, ARCHITECTURE.md, DOCUMENTATION.md, REQUIREMENTS.md, STACK.md
- **Archivos**: AGENTS.md, ARCHITECTURE.md, DOCUMENTATION.md, REQUIREMENTS.md, STACK.md
- **Motivo**: Establecer la estructura documental y metodología SDD desde el inicio del proyecto.

### 2026-06-20 — MVP Scaffold

- **Tipo**: Nueva funcionalidad
- **Descripción**: Implementación inicial del sistema con backend FastAPI + SQLModel + SQLite, frontend React + Vite + TypeScript.
  - Backend: CRUD completo para clientes, servicios, citas, con detección de conflictos de horario y slot de disponibilidad
  - Frontend: Landing page con datos dinámicos, flujo de reserva online con calendario, panel admin placeholder
- **Archivos**: backend/app/*, backend/tests/test_api.py (28 tests iniciales), frontend/src/*
- **Requisitos**: 3.A (Configuración), 3.D (Control de agenda), 2.A (Landing page), 2.B (Reserva online)
- **Motivo**: Entregar un MVP funcional para iterar sobre integraciones y UX.

### 2026-06-21 — Stack Refactor: Migración a TanStack Query

- **Tipo**: Mejora
- **Descripción**: Migración de fetch nativo a TanStack Query en el frontend:
  - Hooks tipados: useAppointments, useClients, useServices, useBusySlots, useConfig, useSchedule
  - Caché automática con staleTime, refetch en mutaciones, invalidación por clave
  - API client centralizado con axios
- **Archivos**: frontend/src/api.ts, frontend/src/hooks/*, frontend/src/pages/*, frontend/src/components/*
- **Requisitos**: Infraestructura frontend
- **Motivo**: Estandarizar fetching de datos, eliminar race conditions y mejorar experiencia de carga/error.
- **Impacto**: Todos los componentes ahora usan hooks con caché, los refetch son automáticos tras mutaciones.

### 2026-06-21 — Stack Refactor: Panel de Configuración (ABM Configuración)

- **Tipo**: Nueva funcionalidad
- **Descripción**: Implementación del panel de configuración del negocio (REQUIREMENTS.md 3.A):
  - Endpoint GET/PUT /config con seed automático
  - UI en Admin.tsx para editar business_name, facebook_url, instagram_url, whatsapp_number, address
  - Landing page ahora consume datos dinámicos desde /config
- **Archivos**: backend/app/main.py, backend/app/models.py, backend/app/schemas.py, frontend/src/pages/Admin.tsx, frontend/src/pages/Home.tsx
- **Requisitos**: 3.A (Gestión de Parámetros del Negocio y Redes)
- **Motivo**: Permitir a la manicurista actualizar la información del negocio sin tocar código.

### 2026-06-22 — Control de Agenda Visual

- **Tipo**: Nueva funcionalidad (SDD: proposal → spec → design → tasks → apply → verify → archive)
- **Descripción**: Reemplazo de lista textual de turnos por calendario visual interactivo:
  - react-big-calendar con vistas day/week/month, códigos de color por estado (Amarillo=Pendiente, Verde=Confirmado, Gris=Asistido, Rojo=Cancelado)
  - AppointmentModal: detalle de turno con edición de fecha/hora, precios, método de pago, notas de verificación
  - MarkAttendedModal: desglose contable (precio - seña = saldo), marca como Asistido, incrementa contador de la clienta
  - PATCH /appointments/{id} extendido: permite reprogramar, cambiar servicios, marcar asistido, ajustar montos
- **Archivos**: backend/app/main.py, backend/app/schemas.py, backend/tests/test_api.py (+3 tests), frontend/src/components/CalendarView.tsx, frontend/src/components/AppointmentModal.tsx, frontend/src/components/MarkAttendedModal.tsx, frontend/src/pages/Admin.tsx, frontend/src/hooks/*, frontend/src/styles.css
- **Requisitos**: 3.D (Control de Agenda y Estados Visuales)
- **SDD**: openspec/changes/archive/2026-06-22-control-agenda-visual/
- **Motivo**: La manicurista necesita una vista de calendario tipo Google Calendar para gestionar turnos visualmente.

### 2026-06-22 — Gestión de Horarios de Atención

- **Tipo**: Nueva funcionalidad (SDD completo)
- **Descripción**: Sistema de gestión de horarios laborales:
  - HorarioSemanal: configuración día por día (activo, apertura, cierre) con seed defaults (Lun-Vie 9-18, Sáb 9-13, Dom cerrado)
  - ExcepcionHorario: feriados o cambios puntuales con prioridad sobre el semanal
  - GET /schedule/effective: endpoint que calcula el horario efectivo para una fecha (excepción > semanal > cerrado)
  - PUT /schedule/weekly: actualización batch de toda la semana
  - Frontend: SchedulePanel en Admin con toggles y sliders de horario, calendar integration con min/max de react-big-calendar
  - Estandarización de fechas a DD/MM/AAAA y horas en formato 24HS en toda la app
- **Archivos**: backend/app/models.py (+ HorarioSemanal, ExcepcionHorario), backend/app/schemas.py, backend/app/main.py, backend/tests/test_api.py, frontend/src/pages/Admin.tsx, frontend/src/components/Calendar.tsx, CalendarView.tsx, frontend/src/hooks/useSchedule.ts, useEffectiveHours (incorporado)
- **Requisitos**: 4 (Lógica de Vencimientos y Reglas de Negocio) — horarios de atención
- **SDD**: openspec/changes/archive/2026-06-22-gestion-horarios/
- **Motivo**: El calendario usaba horarios fijos 8-18; la manicurista necesita configurar su disponibilidad real.

### 2026-06-22 — Edición completa de citas desde admin

- **Tipo**: Mejora
- **Descripción**: Extensión del AppointmentModal para editar todos los campos de la cita:
  - Reprogramar fecha/hora con detección de conflictos
  - Ajustar precios y señas históricas
  - Cambiar método de pago
  - Marcar verificación manual de pago
  - Integración con PATCH /appointments/{id} existente
- **Archivos**: backend/app/main.py, backend/app/schemas.py, frontend/src/components/AppointmentModal.tsx, backend/tests/test_api.py
- **Requisitos**: 3.D (Control de Agenda)
- **Motivo**: El modal era solo lectura; la manicurista necesita modificar datos de citas directamente.

### 2026-06-22 — Filtro de horario laboral en calendario admin

- **Tipo**: Mejora
- **Descripción**: El calendario de gestión admin ahora respeta el horario de atención configurado:
  - CalendarView usa las props min/max de react-big-calendar calculadas desde get_effective_hours
  - El timeline del calendario se ajusta automáticamente al horario laboral del día seleccionado
- **Archivos**: frontend/src/components/CalendarView.tsx
- **Requisitos**: 4 (Reglas de Negocio) — disponibilidad calendario
- **Motivo**: El calendario mostraba el timeline completo 00-24, cuando debería restringirse al horario laboral.

### 2026-06-22 — Bug fix: selección visual de hora

- **Tipo**: Corrección
- **Descripción**: Al seleccionar una hora específica en el calendario de reserva, el slot seleccionado no se resaltaba visualmente. Se corrigió el estado CSS del slot activo y el comportamiento del time indicator.
- **Archivos**: frontend/src/components/Calendar.tsx
- **Motivo**: Bug visual reportado por el usuario — la hora seleccionada no se veía marcada.

### 2026-06-22 — Pipeline CI/CD con GitHub Actions

- **Tipo**: Infraestructura
- **Descripción**: Implementación de CI/CD automatizado para prevenir integración de código roto:
  - CI workflow (`.github/workflows/ci.yml`): jobs paralelos backend-tests (pytest) + frontend-check (tsc + build) en PRs y push a main
  - CD workflow (`.github/workflows/cd.yml`): build multi-stage Docker + push a ghcr.io en push a main
  - Dockerfile multi-stage: node:20-alpine build frontend → python:3.11-slim sirve API + frontend estático
  - FastAPI: StaticFiles mount en `/` con SPA fallback (`html=True`)
  - Frontend: script `typecheck` agregado a package.json
- **Archivos**: `.github/workflows/ci.yml`, `.github/workflows/cd.yml`, `backend/Dockerfile`, `backend/app/main.py`, `frontend/package.json`, `backend/static/.gitkeep`
- **Requisitos**: N/A (infraestructura/tooling)
- **SDD**: `openspec/changes/archive/2026-06-22-ci-cd-pipeline/`
- **Motivo**: Eliminar el riesgo de mergear código que rompa tests o no compile, automatizar la publicación de imágenes Docker.
- **Pendiente post-merge**: Abrir PR trivial para verificar CI, mergear para validar CD, configurar branch protection en GitHub.

### 2026-06-22 — Carga Manual de Citas + Buscador Predictivo

- **Tipo**: Nueva funcionalidad (SDD completo: proposal → spec → design → tasks → apply → verify → archive)
- **Descripción**: Permite a la manicurista cargar turnos manualmente desde el panel admin:
  - Backend: GET /clients/search?q= con búsqueda LIKE por nombre/apellido/teléfono (min 2 chars, max 10 resultados, índice compuesto idx_cliente_search)
  - POST /appointments extendido: acepta estado_cita opcional (Confirmado) y metodo_pago_seña opcional (Efectivo)
  - 8 tests nuevos (5 búsqueda + 3 creación manual), 36 tests total
  - Frontend: ManualAppointmentModal con buscador predictivo (300ms debounce), creación express de clientas, selector de servicios, date/time picker, toggle Confirmado/Efectivo
  - Botón "Cargar Turno Manual" en Admin con refetch automático del calendario
  - Hooks: useClientSearch, useCreateManualAppointment con barrel export
- **Archivos**: backend/app/main.py, backend/app/models.py, backend/app/schemas.py, backend/tests/test_api.py, frontend/src/api.ts, frontend/src/hooks/useClientSearch.ts, frontend/src/hooks/useCreateManualAppointment.ts, frontend/src/hooks/index.ts, frontend/src/components/ManualAppointmentModal.tsx, frontend/src/pages/Admin.tsx, frontend/src/styles.css
- **Requisitos**: 3.C (Carga Manual de Citas y Buscador Predictivo)
- **SDD**: openspec/changes/archive/2026-06-22-carga-manual-citas/
- **Motivo**: Eliminar la dependencia exclusiva del flujo web para crear turnos; la manicurista necesita poder cargar citas telefónicas o presenciales al instante.

---

## Decisiones de diseño (ARCHITECTURE DECISIONS)

| Decisión | Opción Elegida | Alternativa Rechazada | Motivo |
|----------|---------------|----------------------|--------|
| Fetching de datos | TanStack Query (hooks) | fetch nativo, Redux | Caché automática, invalidación por clave, evitar race conditions |
| Calendario admin | react-big-calendar | Construir calendario propio | 80% de los features listos, ahorra meses de desarrollo |
| Scheduling semanal | Tabla HorarioSemanal + ExcepcionHorario | Horarios hardcodeados, calendario laboral único | Flexibilidad para feriados y cambios puntuales |
| Búsqueda de clientas | LIKE con SQLite | Búsqueda exacta, ElasticSearch | Suficiente para <5000 registros, sin dependencias externas |
| Carga manual de citas | Extender POST /appointments existente | Nuevo endpoint dedicado | Evita duplicar lógica de creación y detección de conflictos |
| Schema citas | estado_cita opcional (None = Pendiente) | Campo requerido | Zero breaking change para el flujo web existente |
| Artefactos SDD | Híbrido (OpenSpec + Engram) | Solo Engram o solo archivos | Trazabilidad en repo + recuperación cross-session |
| Fechas | DD/MM/AAAA + 24h en toda la app | Formato ISO por defecto | Locale argentino, la manicurista necesita su formato regional |
| CI Jobs | Jobs paralelos (backend + frontend) | Job único secuencial | Feedback más rápido sin dependencias cruzadas |
| CD workflow | Separado de CI (cd.yml) | Job dentro de ci.yml | Permisos distintos (packages:write) y trigger independiente |
| Docker | Multi-stage (node build + python runtime) | Build separado + artifact passing | Autocontenido, un solo artifact, sin dependencia entre workflows |
| Frontend serving | StaticFiles montado en `/` | nginx separado | Sin infraestructura adicional, SPA fallback automático con html=True |

---

## Pendientes y riesgos

### Features pendientes (de REQUIREMENTS.md)
- **3.B Autenticación y Seguridad**: Login con email de dominio, contraseña segura, recuperación de cuenta.
- **3.B (segunda) Gestión de Catálogo de Servicios**: ABM completo con switch activo/inactivo (solo existe endpoint, falta UI dedicada).
- **3.E Panel de Métricas y Dashboard**: KPIs, filtros, alertas visuales, acciones rápidas.
- **4 Lógica de Vencimientos**: Cancelación automática a 15 días, restricción de booking online.
- **5 Módulo de Notificaciones**: Alertas vía WhatsApp en días 22, 16, 15 previos a la cita.

### Riesgos activos
- Admin.tsx tiene ~650 líneas — considerar extracción de componentes si sigue creciendo.
- Sin autenticación, el panel admin es actualmente público.
- No hay tests frontend (solo verificación TypeScript).
- Branch protection en GitHub no está configurado — CI/CD corre pero no bloquea merges rotos.
- La primera build Docker en CI será lenta (sin cache previo en ghcr.io).
