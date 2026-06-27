# Delta for Admin Agenda Visual

## MODIFIED Requirements

### CAL-001 — Calendario Visual con Toggle

El panel admin DEBE reemplazar la lista de tarjetas por un calendario visual.

- El calendario DEBE soportar 3 modos: día, semana y mes.
- El usuario DEBE poder alternar entre modos mediante botones de toggle.
- El calendario DEBE incluir navegación (anterior/siguiente, "Hoy").
- Las citas DEBEN renderizarse con color según `estado_cita`:
  - `Pendiente` → Amarillo/ámbar
  - `Confirmado` → Verde
  - `Asistido` → Gris con indicador de check
  - `Cancelado_Cliente` / `Cancelado_Sistema_Vencimiento` → Rojo
- Periodos sin citas DEBEN mostrar indicador de "Sin turnos".
- El panel admin DEBE incluir un botón "Cargar Turno Manual" sobre el calendario, junto a los controles de navegación. El botón DEBE abrir ManualAppointmentModal para carga manual de citas con búsqueda predictiva de clientas.
- En viewports <768px, el calendario DEBE iniciar en vista "día" por defecto. Los controles de toggle y navegación DEBEN ser accesibles y legibles en mobile.

(Previously: Calendar always started in week/month view regardless of screen size — unreadable on mobile.)

#### Escenario: Navegación y visualización
- DADO el admin en el panel
- CUANDO selecciona vista "semana" y navega a la semana siguiente
- THEN el calendario muestra las citas de esa semana con colores correctos

#### Escenario: Período vacío
- DADO que no hay citas en el mes actual
- CUANDO el admin selecciona vista "mes"
- THEN se muestra un indicador "Sin turnos registrados"

#### Escenario: Botón abre modal de carga manual
- DADO el admin en el panel con calendario visible
- CUANDO hace click en "Cargar Turno Manual"
- THEN se abre ManualAppointmentModal con buscador predictivo de clientas, selector de servicios, picker de fecha/hora y toggle de estado
- Y el calendario permanece visible detrás del modal

#### Escenario: Calendar defaults to day view on mobile (NEW)

- GIVEN viewport at 375px width
- WHEN the admin panel loads
- THEN CalendarView renders in day view by default
- AND toggle buttons for day/week/month are accessible
- AND the current day's appointments are visible and readable

#### Escenario: Calendar toolbar accessible on mobile (NEW)

- GIVEN viewport at 375px width
- WHEN the admin views the calendar
- THEN navigation controls (prev/next, "Hoy") are visible and tappable
- AND "Cargar Turno Manual" button is accessible
- AND no toolbar elements overflow or overlap

### CAL-006 — CalendarView Responsive Height (MUST)

The CalendarView container MUST use responsive height: full available space on desktop, constrained height on mobile with scroll. The calendar content MUST NOT overflow the viewport.

#### Scenario: Calendar fills desktop viewport

- GIVEN viewport at 1440px width
- WHEN CalendarView renders
- THEN the calendar uses available vertical space efficiently
- AND all time slots are visible or scrollable within the container

#### Scenario: Calendar constrained on mobile

- GIVEN viewport at 375px width
- WHEN CalendarView renders in day view
- THEN the calendar occupies a scrollable area within the page
- AND the page itself does not overflow horizontally
- AND the admin can scroll to see all time slots
