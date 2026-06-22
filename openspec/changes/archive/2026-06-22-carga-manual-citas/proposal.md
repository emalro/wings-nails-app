# Proposal: Carga Manual de Citas + Buscador Predictivo

## Intención

Habilitar a la manicurista a cargar turnos manualmente desde el panel admin con búsqueda predictiva de clientas y bloqueo instantáneo de franja horaria, eliminando la dependencia exclusiva del flujo web de reserva.

## Alcance

### In Scope
- Endpoint `GET /clients/search?q=` con matching parcial por nombre/apellido/teléfono
- Componente de búsqueda predictiva con debounce y dropdown de resultados
- "Registro Express": creación inline de clienta nueva si no hay resultados
- Modal de carga manual con selector de servicios, picker de fecha/hora y toggle opcional de estado (Confirmado / Efectivo)
- Bloqueo de franja vía `find_conflicting_appointment` existente (sin cambios)
- Modificación de `POST /appointments` para aceptar `estado_cita` opcional

### Out of Scope
- Notificaciones WhatsApp para turnos manuales
- Autenticación admin (requisito 3.B separado)
- Dashboard de métricas (ya cubierto por cambios de estado existentes)
- Modificaciones al flujo de booking online público

## Capacidades

### Nuevas Capacidades
- `carga-manual-citas`: Búsqueda predictiva de clientas (find-or-create), creación manual de turnos con confirmación inmediata opcional y bloqueo de agenda.

### Capacidades Modificadas
- `admin-agenda-visual`: Se expande con trigger modal de creación manual y UI de búsqueda de clientas.
- `frontend-data-fetching`: Nuevos hooks para `useClientSearch` y `useCreateManualAppointment`.

## Enfoque

1. Backend: `GET /clients/search?q=` devuelve matches parciales. `POST /appointments` acepta `estado_cita` opcional para crear directamente como Confirmado.
2. Frontend: Botón "Cargar Turno Manual" en Admin → modal con buscador predictivo, selector de servicios, fecha/hora, toggle Confirmado/Efectivo.
3. Bloqueo de agenda usa el mecanismo existente — no requiere cambios.

## Áreas Afectadas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `backend/app/main.py` | Modificado | Nuevo endpoint `GET /clients/search` |
| `backend/app/schemas.py` | Modificado | `estado_cita` opcional en `CitaCreate` |
| `frontend/src/api.ts` | Modificado | Nueva función `searchClients()` |
| `frontend/src/hooks/` | Modificado | Nuevos hooks `useClientSearch`, `useCreateManualAppointment` |
| `frontend/src/pages/Admin.tsx` | Modificado | Botón + trigger para modal manual |
| `frontend/src/components/ManualAppointmentModal.tsx` | Nuevo | Modal completo de carga manual |

## Riesgos

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Condición de carrera doble-reserva | Baja | Conflict detection existente es síncrono |
| Duplicación de clientas por typos | Media | Búsqueda parcial + Registro Express exige nombre+teléfono completos |
| Admin.tsx demasiado grande | Media | Extraer a componente separado ManualAppointmentModal |

## Plan de Rollback

Revertir cambio de firma `POST /appointments`; eliminar `GET /clients/search`; borrar `ManualAppointmentModal.tsx`; restaurar `Admin.tsx`.

## Dependencias

Ninguna — todos los modelos existen, toda la infraestructura está en su lugar.

## Criterios de Éxito

- [ ] Admin puede buscar clientas por nombre, apellido o teléfono con respuesta < 300ms
- [ ] Clientas nuevas se crean inline sin salir del modal
- [ ] Turnos creados manualmente aparecen en calendario y bloquean `busy_slots` instantáneamente
- [ ] Todos los tests existentes pasan
