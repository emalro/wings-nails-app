# Delta for Online Booking

## MODIFIED Requirements

### REQ-BKG-002 — Flujo Multi-Step (MUST)

La reserva DEBE tener 4 pasos secuenciales: (1) selección de servicio, (2) datos del cliente (nombre, apellido, teléfono, DNI) + calendario, (3) resumen con servicio, total, seña y datos ingresados + botón "Confirmar turno", (4) pantalla de pago con CBU/Alias y monto de seña. El paso 2 DEBE utilizar grid responsive: en mobile (<768px) el calendario y el formulario de datos DEBEN apilarse verticalmente. En desktop (≥768px) DEBEN mostrarse en dos columnas lado a lado.

(Previously: Step 2 had no responsive grid behavior — content could overflow on mobile.)

#### Scenario: Flujo completo
- DADO una clienta en /reservar
- CUANDO selecciona servicio, completa datos con DNI, elige fecha/hora y confirma resumen
- THEN el sistema crea cliente y cita (estado Pendiente)
- Y la clienta ve pantalla de pago con CBU/Alias y monto de seña

#### Scenario: DNI faltante en paso 2
- DADO una clienta en paso 2
- CUANDO intenta avanzar sin DNI
- THEN el formulario muestra error "DNI es obligatorio"

#### Scenario: Servicio no seleccionado
- DADO una clienta sin servicio seleccionado
- CUANDO intenta confirmar
- THEN el sistema muestra "Seleccioná un servicio antes de continuar"

#### Scenario: Step 2 stacks on mobile (NEW)

- GIVEN a client in step 2 at 375px viewport
- WHEN the step 2 view renders
- THEN the calendar and data form stack vertically in a single column
- AND all content is visible without horizontal overflow
- AND scroll reaches the confirm button

#### Scenario: Step 2 side-by-side on desktop (NEW)

- GIVEN a client in step 2 at 1024px viewport
- WHEN the step 2 view renders
- THEN the calendar displays on one side and the data form on the other
- AND both panels are fully visible without scrolling horizontally
