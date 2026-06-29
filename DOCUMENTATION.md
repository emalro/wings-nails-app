# DOCUMENTATION.md

> Última actualización: 29/06/2026

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

### 2026-06-23 — Online Booking Flow Completo

- **Tipo**: Nueva funcionalidad (SDD completo: proposal → spec → design → tasks → apply → verify → archive)
- **Descripción**: Implementación del flujo completo de reserva online /reservar con 4 pasos según REQUIREMENTS.md §2.B:
  - **REQ-BKG-001**: CBU/Alias en Configuracion (modelo, schemas, inputs en Admin.tsx)
  - **REQ-BKG-002**: Flujo multi-step en Reservar.tsx con Step enum: servicio → datos+DNI+calendario → resumen+confirmar → pago
  - **REQ-BKG-003**: WhatsApp deep link con template pre-redactado (nombre, fecha, servicio, seña) y fallback si número vacío
  - **REQ-BKG-004**: Campo DNI obligatorio en paso 2, enviado a POST /clients
  - **REQ-BKG-005**: Slots ocupados muestran "Ocupado" con mensaje de privacidad en Calendar.tsx
- **Archivos**: backend/app/models.py, backend/app/schemas.py, backend/tests/test_api.py (+22 tests), frontend/src/pages/Reservar.tsx (refactor 4-step), frontend/src/components/Calendar.tsx, frontend/src/pages/Admin.tsx, frontend/src/api.ts
- **Requisitos**: 2.B (Flujo de Reserva Online)
- **SDD**: openspec/changes/archive/2026-06-23-online-booking-flow/
- **Motivo**: REQUIREMENTS.md §2.B estaba parcialmente implementado (faltaba DNI en form, pantalla de pago, WhatsApp, labels de privacidad, manejo de errores)

### 2026-06-23 — Post-SDD: Multi-servicio y feedback visual en reserva

- **Tipo**: Mejora
- **Descripción**: Correcciones post-archive del flujo de reserva online:
  - **Multi-servicio**: `selectedService: number | null` → `selectedServices: number[]`. Toggle en grid de servicios con checkmark, resumen de cantidades y totales en paso 1, payload con todos los servicios seleccionados en POST /appointments (backend ya soportaba múltiples vía CitaServicio)
  - **Feedback visual inline**: Sistema de validación por campo con `touched` state, errores en blur y onChange, clases CSS `.input-error` (borde rojo) y `.field-error` (texto de error debajo del input). Validaciones específicas: DNI 7-8 dígitos, teléfono ≥6 dígitos, campos obligatorios.
  - **Mensajes de disponibilidad detallados**: Calendar.tsx diferencia entre "Local cerrado", "Cierra antes de que termine el servicio", "Todos los horarios están ocupados", y "No se pudieron cargar los horarios".
- **Archivos**: frontend/src/pages/Reservar.tsx, frontend/src/components/Calendar.tsx, frontend/src/styles.css
- **Requisitos**: 2.B (REQ-BKG-002 — flujo multi-step)
- **Motivo**: El usuario reportó que se perdió la selección múltiple de servicios en el refactor a 4 pasos y faltaba feedback visual de errores en formulario y disponibilidad.

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

### 2026-06-27 — Visual Style Refresh: rose + lavender pastel girly

- **Tipo**: Nueva funcionalidad / Mejora (SDD completo: proposal → spec → design → tasks → apply → verify → archive)
- **Descripción**: Refresh completo de la identidad visual de la app, de "wine + gold" a una dirección "pastel girly" basada en rosa y lavanda. Toca 24 archivos (21 modificados + 3 nuevos) en 12 commits atómicos bajo `size:exception` formalmente aprobado (forecast 600–750 líneas vs presupuesto de 400).
  - **Sistema de tokens**: 23 tokens de marca + 4 de estado definidos como CSS custom properties en `:root` dentro de `frontend/src/index.css`. `frontend/tailwind.config.js` espeja los mismos hex bajo un namespace M3-flavor plano (primary, secondary, tertiary, ...). Las clases `brand.*` y `gold.*` huérfanas se retiran. La fuente body pasa de Inter a Plus Jakarta Sans; la display sigue siendo Playfair Display. Preconnect + `display=swap` preservados.
  - **Wine y gold eliminados**: Los hex wine y gold (los valores previos) ya no aparecen en tokens, gradientes, status colors, box-shadow tints, ni en ningún componente renderizado. Las shadow tints cambian del rgba wine al rgba rose (`rgba(184, 87, 118, ...)`).
  - **Excepción documentada**: `--status-pending: #D4A85F` (warm gold) se mantiene SOLO para semántica de estado de cita (es el token Pendiente del calendario). Es la única "warm tone" del sistema y está documentada como excepción semántica. White text sobre este color falla AA (~2.5:1); por eso los eventos de calendario y badges sobre `--status-pending` usan text dark (`var(--on-background)`), no white.
  - **CSS vars como source of truth**: `:root` es la fuente única; `tailwind.config.js theme.extend.colors` es un espejo. Cualquier cambio de hex se hace en ambos archivos en el mismo commit. La verificación del grep retorna 0 matches en `frontend/src/components/`, `frontend/src/pages/`, `frontend/src/App.tsx`, y `frontend/src/lib/`.
  - **Mapeo de status colors**: El módulo `frontend/src/lib/statusColors.ts` exporta `STATUS_VARS` (referencias CSS-var, preferidas para estilos inline) y `STATUS_COLORS` (hex resueltos via `getComputedStyle`, usados por `react-big-calendar.eventPropGetter`). Cero hex literales en el módulo. Calendario y modales consumen este módulo en lugar de definir `STATUS_COLORS` inline. Mapeo semántico:
    - Pendiente → `--status-pending` (`#D4A85F` warm gold — dark text)
    - Confirmado → `--status-confirmed` (`#7A5A8F` lavender)
    - Asistido → `--status-attended` (`#7AA899` sage)
    - Cancelado (Cliente + Sistema) → `--status-cancelled` (`#C66B7E` rose)
  - **A11y baseline**: skip link "Saltar al contenido principal" como primer elemento focuseable de cada página; target `id="main" tabIndex={-1}` en `<main>`; anillo `:focus-visible` global de 2px solid `var(--primary)` + 2px offset; inputs y buttons usan `box-shadow: 0 0 0 3px var(--primary-container)` además del outline; gate global de `prefers-reduced-motion: reduce` que zero todas las transiciones + `scroll-behavior: auto`; mobile drawer con focus trap (Tab/Shift+Tab) + Escape cierra + close button recibe focus al abrir; touch targets: 24×24 mínimo WCAG 2.2 SC 2.5.8, 44×44 para CTAs primarios; `aria-label` en cada icono de navbar y FAB; `aria-modal="true"` + `aria-label` en mobile drawer; `aria-expanded` + `aria-controls` en el toggle hamburguesa.
  - **ScrollToTop**: nuevo componente flotante rose-tinted glass (único elemento glass del diseño), con `backdrop-filter: blur(8px)` + fallback sólido via `@supports not`. Aparece tras `scrollY > 400`, hidden via `display: none` para sacarlo del a11y tree y tab order. Click mueve focus a `<main id="main">`. Lee `prefers-reduced-motion` para usar `behavior: 'auto'` cuando el usuario prefiere reduced motion.
  - **Home**: hero radial rose (rose → blush → background) en lugar de linear wine. Dos CTAs sobre el fold: "Reservar Turno" (rose primario) + "Contactar por WhatsApp" (lavender secundario). Bento layout: primer card ocupa 2 columnas en ≥1024px cuando hay ≥3 servicios, grid usa `repeat(auto-fill, minmax(280px, 1fr))` por REQ-VIS-011. Nueva sección Conectemos con 3 chips (WhatsApp rose, Instagram lavender, Facebook rose-variant) + address. CTA section gradient rose → tertiary. Map hint color rose. Chip "Calidad Premium" glass eliminado.
  - **Reservar**: step machine, validación, busy-slot detection, submit behavior y FAB preservados. Re-skin puramente visual.
  - **Admin**: calendar, modals, tabs, secciones admin re-skinneadas. Calendar consume `lib/statusColors`. `AppointmentModal`, `MarkAttendedModal`, `ManualAppointmentModal` re-skinneados.
  - **Login**: flash messages usan `--status-pending` / `--status-cancelled` en lugar de `#d97706` / `#dc2626`. Auth-required (warm gold) usa dark text por la excepción AA. Nuevo "¿Problemas para ingresar? Escribinos" WhatsApp help link con `aria-label="Contactar por WhatsApp"`.
  - **Compatibilidad hacia atrás**: Aliases en `:root` (`--muted`, `--border`, `--text`, `--text-secondary`, `--bg`, `--primary-light`, `--primary-dark`) apuntan a los tokens nuevos. Permiten que el JSX de los componentes siga usando `text-[var(--muted)]` y `border-[var(--border)]` sin reescritura mecánica. El refactor mecánico `text-[var(x)] → bg-primary` queda fuera de scope y se hace en un change separado.
- **Archivos afectados**:
  - `frontend/tailwind.config.js` (modificado) — mirror de tokens
  - `frontend/src/index.css` (modificado) — :root reescrito, a11y base, BEM re-skin
  - `frontend/index.html` (modificado) — Plus Jakarta Sans, theme-color
  - `frontend/src/lib/statusColors.ts` (nuevo)
  - `frontend/src/components/SkipLink.tsx` (nuevo)
  - `frontend/src/components/ScrollToTop.tsx` (nuevo)
  - `frontend/src/App.tsx` (modificado) — shell re-skin + mount SkipLink/ScrollToTop/FAB + focus trap
  - `frontend/src/pages/Home.tsx` (modificado) — hero radial, bento, dual CTAs, Conectemos
  - `frontend/src/pages/Reservar.tsx` (modificado) — token swap
  - `frontend/src/pages/Admin.tsx` (modificado) — token swap
  - `frontend/src/pages/Login.tsx` (modificado) — flash tokens, WhatsApp help link
  - `frontend/src/components/Calendar.tsx` (modificado) — token swap
  - `frontend/src/components/CalendarView.tsx` (modificado) — consume lib/statusColors
  - `frontend/src/components/AppointmentModal.tsx` (modificado) — consume lib/statusColors
  - `frontend/src/components/MarkAttendedModal.tsx` (modificado) — error hex → token
  - `frontend/src/components/ManualAppointmentModal.tsx` (modificado) — wine fallback removido
  - `frontend/src/components/ClientSection.tsx` (modificado) — token swap
  - `frontend/src/components/DataTable.tsx` (modificado) — token swap
  - `frontend/src/components/SkeletonLoader.tsx` (modificado) — `bg-gray-200` → `bg-surface-container`
  - `frontend/src/components/FieldError.tsx` (sin cambios — el color fluye desde `.field-error` BEM)
  - `frontend/src/components/admin/{Services,Schedule,Exceptions,BusinessConfig}Section.tsx` (modificados) — token swap
- **Requisitos**: REQ-VIS-001..013, REQ-FONT-001, REQ-A11Y-001..006 (visual-identity), MRL-006 (mobile-responsive-layout), CAL-007, CAL-008 + CAL-001/CAL-006 modified (admin-agenda-visual), REQ-BKG-002 modified, REQ-BKG-006, REQ-BKG-007 (online-booking), FE-003 (frontend-data-fetching)
- **SDD**: `openspec/changes/visual-style-refresh/`
- **Motivo**: La identidad wine + gold leía como "vino y dorado formal" en un negocio de manicuría; la dirección pastel girly (rose + lavender) refleja mejor la marca. La paleta anterior también adolecía de un status color warm gold que entraba en conflicto con la nueva identidad.
- **Impacto esperado**: Refresh visual completo sin cambios funcionales. Mejor contraste WCAG 2.2 AA en pares críticos. Skip link, focus rings, y motion gate mejoran el acceso a teclado. La excepción `--status-pending` warm gold se mantiene por su significado semántico, no por decoración.
- **size:exception**: El forecast de diff fue 600–750 líneas vs el presupuesto de revisión de 400. El usuario aprobó formalmente la excepción antes del apply phase; se documentó en `sdd/visual-style-refresh/size-exception` (Engram topic). Se solicitó excepción formal porque la refresh toca toda la app de forma acoplada; partir en chained PRs introduciría estados intermedios donde medio shell usa tokens nuevos y medio usa viejos.

### 2026-06-28 — Custom alert frontend para seña > precio (REQ-DVA-001..005)

- **Tipo**: Nueva funcionalidad / Mejora (SDD: deposit-front-alert)
- **Descripción**: Cierra el pendiente `deposit-validation/front-alert/todo` heredado de PR #47 (`8e5d568`). El backend ya emite `PydanticCustomError` con `type === "seña_excede_precio"` (con ñ, desde `Servicio*`) o `type === "sena_excede_precio"` (sin ñ, desde `Cita*`); el frontend ahora muestra un mensaje en español específico para esa violación en lugar de comerse la lista `[object Object]` detrás de un `||` fallback. Cierra también S-1 (offset `-03:00` explícito) y S-2 (round-trip PATCH con Z) del verify-report de `tz-argentina-display` (engram #228 §6).
- **Archivos**:
  - `frontend/src/lib/apiErrors.ts` (nuevo) — helper `getApiError(err)` + tabla `API_ERROR_MESSAGES` con ambas spellings; type `ApiError` y `ApiErrorType`.
  - `frontend/src/lib/apiErrors.test.ts` (nuevo) — 6 casos Vitest: cita context (no ñ), service context (con ñ), unknown 422, 422 con `detail` string, error no-Axios, error plano.
  - `frontend/src/pages/Reservar.tsx` (modificado) — branch 422 de `handleConfirm` consume `getApiError(err).message`.
  - `frontend/src/components/ManualAppointmentModal.tsx` (modificado) — catch de `createAppointment` consume `getApiError(err).message`.
  - `frontend/src/pages/Admin.tsx` (modificado) — `handleSaveAppointment`, `handleCreateService`, `handleUpdateService` consumen `getApiError(err).message`.
  - `backend/tests/test_api.py` (modificado) — 1 sub-assertion S-1 en `test_appointment_datetime_aware_input_serializes_naive`, 1 test nuevo S-2 `test_cita_patch_with_z_suffix_preserves_wall_clock`, 2 tests nuevos anti-typo `test_post_services_with_sena_mayor_returns_422_with_literal_type_senia` y `test_post_appointments_with_sena_mayor_returns_422_with_literal_type_sena`.
- **Requisitos**: REQ-DVA-001 (backend emitters ya en main), REQ-DVA-002 (frontend custom alert en 4 superficies), REQ-DVA-003 (anti-typo guard), REQ-DVA-004 (S-1 offset `-03:00`), REQ-DVA-005 (S-2 round-trip PATCH).
- **SDD**: `openspec/changes/deposit-front-alert/`
- **Motivo**: UX de error. La violación `seña > precio` es una regla de negocio que la manicurista necesita entender de un vistazo; el fallback genérico la ocultaba detrás de `[object Object]`. El anti-typo guard blinda el contrato frontend-backend contra "typo fix" futuros que rompan el match en silencio. S-1 y S-2 cierran gaps del verify-report de la fix previa de timezone.
- **Impacto esperado**: Mensajes de error específicos (servicio vs turno) en lugar de `[object Object]` en 4 superficies. 114 tests backend pasando (era 111). 6 tests Vitest nuevos. `npx tsc --noEmit` limpio. Sin migraciones de DB, sin schema drift. Revert restaura el `||` fallback previo sin side effects.

---

### 2026-06-29 — Public Booking Endpoints (REQ-PUB-001..010)

- **Tipo**: Nueva funcionalidad (SDD: public-booking)
- **Descripción**: Cierra el gap de arquitectura que rompía `/reservar`: el frontend llamaba `POST /clients` y `POST /appointments` como visitante no autenticado, pero ambos requieren `Depends(get_current_user)` — cada submit retornaba 401 y la reserva se perdía silenciosamente. Esta entrega agrega 2 endpoints nuevos `POST /public/clients` y `POST /public/appointments` con throttling T2 (honeypot + per-DNI 3/day + per-IP 10/min), respuesta minimal-info `{id, was_existing}` (sin PII), y audit log estructurado. Las rutas admin (`/clients`, `/appointments`) quedan intactas y auth-gated.
- **Archivos**:
  - `backend/app/schemas.py` (modificado, +77) — `PublicClientLookupRequest/Response`, `PublicCitaServicioCreate`, `PublicAppointmentCreate/Response` con `extra="forbid"` (rechaza `id_cliente` y `estado_cita` del body), reuse de `normalize_phone` y patrón `sena_excede_precio`.
  - `backend/app/main.py` (modificado, +284) — 2 endpoints + 2 async deps (`parse_public_client_payload`, `parse_public_appointment_payload`) + `get_dni_key` (slowapi key_func per-DNI) + `log_public_booking` helper + `IntegrityError` import. El pre-check de DNI desactivado evita que el UNIQUE constraint en `cliente.dni` se dispare cuando un registro desactivado bloquea el INSERT (D5 + REQ-PUB-008).
  - `backend/tests/test_api.py` (modificado, +488) — 25 tests nuevos: 6 schema-direct, 5 `/public/clients`, 7 `/public/appointments`, 7 edge (race, per-IP 429, per-DNI 429, audit log success/honeypot en ambas rutas). Re-introducido `@pytest.fixture(autouse=True) def _reset_rate_limiter()` (patrón B-8 reverted) para que el cap per-IP no acumule 429 espurios entre tests.
  - `frontend/src/components/HoneypotField.tsx` (nuevo, +52) — input off-screen con `name="website"` (DOM) vs `honeypot` (JSON key) según D7; aria-hidden, tabindex=-1, autocomplete=off.
  - `frontend/src/components/HoneypotField.test.tsx` (nuevo, +28) — 2 casos vitest (atributos DOM + posición off-screen ≠ display:none).
  - `frontend/src/api.ts` (modificado, +62) — tipos `PublicClientLookupRequest/Response`, `PublicCitaServicioCreate`, `PublicAppointmentCreate/Response` + funciones `lookupOrCreatePublicClient` y `createPublicAppointment`.
  - `frontend/src/pages/Reservar.tsx` (modificado) — `handleConfirm` ahora usa las nuevas funciones; `id_cliente` removido del payload; `honeypot: ''` agregado a ambos; `<HoneypotField/>` embebido en form JSX; `buildWhatsAppUrl` deriva `cliente_nombre` de `form.values` (la respuesta minimal del backend ya no lo incluye).
  - `openspec/changes/public-booking/` (nuevo) — 4 design docs (proposal, spec, design, tasks).
- **Requisitos**: REQ-PUB-001..010 (lookup-or-create, hardcoded Pendiente, extra=forbid, honeypot silent 200, per-DNI 3/day, per-IP 10/min, deactivated → 404, audit log, race resolution).
- **SDD**: `openspec/changes/public-booking/`
- **Motivo**: `/reservar` era la superficie de booking del salón y estaba rota en producción (silent 401). El design intent previo B-8 (`f2a86b6`) intentó hacer `/clients` y `/appointments` públicos, pero rompía la separación admin/public; revertido en `b02ce05`. Esta entrega crea rutas dedicadas con throttling dedicado y preserva los admin paths.
- **Riesgos conocidos**:
  - R2 (R2 del design): el rate-limit de slowapi es in-memory, se resetea en cada restart de Render. Aceptable para el volumen low-tenant.
  - R3 del design: el test de race usa sequential session simulation (más determinista que threading); el branch de IntegrityError está cubierto.
  - Race real solo ocurre bajo concurrencia simultánea con el mismo DNI; en la práctica el cap per-DNI 3/day hace que el escenario sea muy raro.
- **Desviaciones del design original**:
  - REQ-PUB-005 original pedía 422 con `PydanticCustomError`; resuelto como silent 200 con audit log (`outcome="honeypot"`) para que el bot no reciba señal (O1). El test `test_public_booking_audit_log_honeypot` blinda el nuevo contrato.
  - El ejemplo `public_lookup_or_create_client` del design.md usaba `status_code=201` como default del route; el branch hit ahora retorna 200 vía `response: Response` injection (REQ-PUB-001 scenario).
- **Impacto esperado**: `/reservar` funciona end-to-end para visitantes no autenticados. 139 tests backend pasando (era 114, +25 nuevos). 19 tests vitest pasando (era 17, +2 nuevos). `npx tsc --noEmit` limpio. Sin migraciones de DB. Revert restaura el comportamiento anterior (silent 401) sin side effects.

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
| CSS tokens | Custom properties en `:root` + espejo en tailwind.config.js | Inline hex en componentes, Sass variables | Single source of truth (`:root`); Tailwind utilities resolviendo al mismo hex; cambia un archivo y cambia la app |
| Status colors | Módulo TS (`lib/statusColors.ts`) con valores resueltos via `getComputedStyle` | Constantes TS con hex literales hardcodeados | Cero hex literales en el módulo; cualquier cambio de token fluye sin tocar el módulo; `eventPropGetter` de react-big-calendar requiere hex concreto, mientras que estilos inline aceptan `var(...)` |
| Glassmorphism | Solo ScrollToTop, con `@supports` fallback a solid rose | Glass en hero, chips, cards | Restringido a una única affordance flotante para preservar legibilidad AA y consistencia visual; cualquier otro glass se delega a un follow-up |
| `--status-pending` warm gold | Mantenido solo para semántica de estado | Eliminarlo por ser warm tone no-rosa | Reconocer el significado semántico (Pendiente = "warm, awaiting") es importante para el admin; dark text compensa el contraste AA fallido |
| A11y baseline | Global rules en `@layer base` (focus-visible, reduced-motion, skip-link) + componentes focales | Per-component a11y attributes | El single source de reglas globales reduce el riesgo de olvidar la a11y en un componente nuevo; los componentes focales (SkipLink, ScrollToTop) sólo necesitan el contrato del BEM |

---

### 2026-06-24 — Extracción de componentes Admin.tsx (PR #1 de Auth)

- **Tipo**: Refactor / Infraestructura
- **Descripción**: Extracción de 4 componentes del monolito Admin.tsx (696 líneas) como prerrequisito para la implementación de autenticación. Cada componente maneja una sección independiente del panel de administración.
- **Archivos afectados**:
  - `frontend/src/components/admin/ScheduleSection.tsx` (nuevo) — Tabla de horarios semanales
  - `frontend/src/components/admin/ExceptionsSection.tsx` (nuevo) — ABM de excepciones
  - `frontend/src/components/admin/BusinessConfigSection.tsx` (nuevo) — Form de configuración del negocio
  - `frontend/src/components/admin/ServicesSection.tsx` (nuevo) — CRUD de servicios
  - `frontend/src/pages/Admin.tsx` (modificado) — Refactorizado a ~150 líneas, orquestador de secciones
- **Requisitos relacionados**: 3.B Autenticación (prerrequisito), 3.E Panel de Métricas
- **Motivo**: Admin.tsx con 696 líneas es imposible de mantener y riesgoso para integrar auth. La extracción reduce el archivo a ~150 líneas y crea componentes focados y testables.
- **Impacto esperado**: Sin cambio funcional. Misma UI, misma lógica, mejor estructura. Preparado para envolver con ProtectedRoute en PR #2.
- **Cadena de PRs**: PR #1 (este) → PR #2 (auth completo)

---

### 2026-06-24 — Implementación de autenticación JWT (PR #2)

- **Tipo**: Nueva funcionalidad
- **Descripción**: Implementación completa de autenticación para el panel /admin. JWT + httpOnly cookies, rate limiting en login, CORS restrictivo, extracción de Admin.tsx como prerrequisito.
- **Archivos afectados**:
  - `backend/app/auth.py` (nuevo) — Utilidades JWT: create_access_token, create_refresh_token, verify_token, get_password_hash
  - `backend/app/deps.py` (nuevo) — Dependencias FastAPI: get_current_user
  - `backend/app/models.py` (modificado) — Modelo Usuario
  - `backend/app/schemas.py` (modificado) — Schemas LoginRequest, TokenResponse, UserRead
  - `backend/app/main.py` (modificado) — Endpoints auth, CORS env-based, rate limiting, seed admin
  - `backend/app/database.py` (modificado) — Import Usuario en create_db_and_tables
  - `backend/requirements.txt` (modificado) — python-jose, passlib, slowapi
  - `frontend/src/contexts/AuthContext.tsx` (nuevo) — Estado de autenticación
  - `frontend/src/hooks/useAuth.ts` (nuevo) — Hook de autenticación
  - `frontend/src/pages/Login.tsx` (nuevo) — Página de login
  - `frontend/src/components/ProtectedRoute.tsx` (nuevo) — Ruta protegida
  - `frontend/src/api.ts` (modificado) — Auth API + interceptor axios
  - `frontend/src/main.tsx` (modificado) — AuthProvider + rutas
  - `frontend/src/App.tsx` (modificado) — Navbar con botón "Ingresar"
- **Requisitos relacionados**: 3.B Autenticación y Seguridad
- **Motivo**: El panel admin es completamente público. Cualquiera con la URL accede a CRUD, clientas, turnos y configuración.
- **Impacto esperado**: /admin protegido con JWT. Login obligatorio. CORS restrictivo. Rate limiting en intentos de login.
- **Decisiones técnicas**:
  - Tokens en httpOnly cookies (no localStorage) — protección XSS
  - CORS: env var CORS_ORIGINS con orígenes explícitos
  - Rate limiting: slowapi, 5 intentos/min, lockout 15 min después de 3 fallos
  - Admin seed desde env vars en cada startup
- **Cadena de PRs**: PR #1 (extracción) → PR #2 (este)

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

### 2026-06-23 — Fix: API URL hardcodeada a localhost en build de producción

- **Tipo**: Corrección
- **Descripción**: `VITE_API_URL` default `'http://localhost:8000'` rompía todos los llamados a la API desde prod porque el browser del usuario resuelve `localhost` a su propia máquina, no al servidor. Cambiado a `''` (URL relativa) para que el frontend use la misma origen del servidor que lo sirve.
- **Archivos afectados**: `frontend/src/api.ts`
- **Motivo**: En producción, FastAPI sirve tanto el SPA como la API desde el mismo origen. Usar URL absoluta a `localhost` hace que las requests nunca lleguen al backend.
- **Impacto esperado**: Todas las operaciones del admin (crear servicios, turnos, clientas) funcionan correctamente en producción.
- **Riesgo residual**: En desarrollo, requiere tener `VITE_API_URL` seteada en `.env` si el dev server de Vite está en otro puerto que el backend.

---

### 2026-06-28 — Fix: serialización de datetimes con timezone en respuestas API

- **Tipo**: Corrección
- **Descripción**: El PR #46 (`timezone-fix`) agregó el helper `naive()` para comparaciones pero nunca cableó el `field_serializer` en los schemas de respuesta. Como resultado, cuando la base de datos devolvía un datetime con `tzinfo` (caso PostgreSQL/Supabase con `TIMESTAMP WITH TIME ZONE`), Pydantic v2 emitía el sufijo `Z` o el offset `+00:00`. En el navegador argentino (UTC-3) eso provocaba un desplazamiento de 3 horas: la cita booked a las 09:00 aparecía a las 06:00 y el overlap check de slots ocupados fallaba silenciosamente.

  Cambios aplicados:
  - `backend/app/schemas.py`: helper `_strip_tz()` y `@field_serializer` en `CitaRead.fecha_hora_cita`, `CitaRead.fecha_registro_cita`, `ClienteRead.fecha_creacion`.
  - `backend/app/schemas.py`: `@field_validator(mode="before")` en `CitaCreate.fecha_hora_cita` y `CitaUpdate.fecha_hora_cita` que normaliza input aware a naive (evita round-trip asymmetry en PostgreSQL).
  - `backend/app/main.py`: wrap de las dos llamadas `isoformat()` en `get_busy_slots` con `naive()` local (el endpoint no declara `response_model`, por lo que el serializer del schema no corre ahí).
  - `backend/tests/test_api.py`: nuevo test de regresión `test_appointment_datetime_aware_input_serializes_naive` que cubre los 5 escenarios del spec (PROD-A/B/C/D/E).
- **Archivos afectados**: `backend/app/schemas.py`, `backend/app/main.py`, `backend/tests/test_api.py`
- **Requisitos relacionados**: REQ-DCO-004 (serializer defensivo), REQ-DCO-005 (normalización de input)
- **Motivo**: Regresión de `timezone-fix` PR #46 — el test existente solo cubría el path de SQLite (naive), por lo que el bug pasó la verificación. En producción con Supabase los turnos se mostraban con 3 horas de shift.
- **Impacto esperado**: Las citas de producción ahora se muestran en el wall-clock time exacto que la clienta reservó. El overlap check de "Ocupado" en el calendario funciona correctamente.
- **Decisiones técnicas**:
  - Field-level `@field_serializer` en lugar de base class — la superficie del bug es exactamente 3 campos, no se justifica una abstracción global.
  - Strip directo (`replace(tzinfo=None)`) en input en vez de conversión a UTC — el sistema opera en un único timezone, "store lo que la usuaria quiso decir" es la convención correcta.
  - Test usa aserciones directas sobre modelos Pydantic además de smoke tests de integración — SQLite strippea tzinfo en el read, por lo que la ruta de integración no puede reproducir el bug de PostgreSQL. Las aserciones Pydantic sí lo capturan.
- **Riesgo residual**: Ninguno en el flujo actual. Si se agrega un nuevo endpoint que devuelva datetime, debe declarar `response_model` (CitaRead/ClienteRead) o aplicar `naive()` manualmente — el comentario inline en `get_busy_slots` lo documenta.

### 2026-06-28 — Fix: calendario admin — días en español y min/max ajustado a turnos

- **Tipo**: Corrección de UX
- **Descripción**: Dos issues en `frontend/src/components/CalendarView.tsx` (calendario admin con `react-big-calendar`):
  1. `react-big-calendar` trae un objeto `messages` default en inglés (`allDay`, `previous`, `next`, `today`, `noEventsInRange`, `showMore`, etc.) que se filtraba en la UI. El custom Toolbar al pie pisa solo los nombres de las views (Día/Semana/Mes) pero no el resto. Ahora se pasa un `messages` con todas las traducciones al español.
  2. El `min` y `max` del calendario se fijaban en `hora_apertura` y `hora_cierre` del horario efectivo, por lo que el grid mostraba todas las horas del rango de operación aunque no hubiera turnos. Ahora computa los bounds desde los appointments presentes en la vista actual (día o semana), con padding de 1h y clamp contra apertura/cierre. Si no hay turnos en la vista, cae al comportamiento anterior (apertura/cierre).
- **Archivos afectados**: `frontend/src/components/CalendarView.tsx` (calendarMessages agregado, viewBounds useMemo para min/max ajustado a turnos, prop `messages` en `<Calendar>`)
- **Requisitos relacionados**: ninguno formal (UI/UX). Cambio chico y autocontenido, sin implicancia en el spec.
- **Motivo**: Issue reportado por la usuaria — días de la semana y textos auxiliares (allDay, noEventsInRange, +N more) salían en inglés, y la vista diaria/semanal mostraba horas vacías arriba/abajo del bloque real de turnos.
- **Impacto esperado**: Calendario admin completamente en español y el rango visible se ajusta a los turnos existentes con un margen razonable.
- **Decisiones técnicas**:
  - Reutilizar `date-fns/locale es` ya importado para `startOfWeek`/`endOfWeek` con `weekStartsOn: 1` (lunes) — consistente con el resto del código que arranca la semana en lunes.
  - Padding de 1h antes del primer turno y después del último: evita que los eventos queden pegados al borde superior/inferior del grid.
  - Si no hay turnos en la vista, vuelve a apertura/cierre (no acota a un solo día si la semana entera está vacía).
- **Riesgo residual**: Si hay un turno a las 23:00 y el cierre es a las 18:00, el `max` se va a 24:00 (porque el turno + 1h padding se extiende más allá del cierre). Esto es intencional — el admin necesita ver el turno aunque caiga fuera del horario comercial. Si el horario flexible se vuelve un problema, se puede ajustar el padding o agregar un cap explícito.
