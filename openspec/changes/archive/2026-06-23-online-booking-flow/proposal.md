# Proposal: Flujo Completo de Reserva Online

## Intent

Completar el flujo de reserva online (`/reservar`) con pantalla de pago, envío de comprobante por WhatsApp y resumen previo a la confirmación. REQUIREMENTS.md §2.B actualmente está implementado parcialmente — falta el post-booking.

## Scope

### In Scope
- CBU/Alias en Configuracion (model + schema + admin UI)
- Campo DNI en formulario de booking (hoy falta, el endpoint lo requiere)
- Flujo multi-step: seleccionar servicio → datos + calendario → resumen → pantalla pago → WhatsApp
- Resumen confirmación: detalle servicio, total, seña, datos cliente
- Pantalla de pago: CBU/Alias del negocio + monto seña + instrucciones
- Botón WhatsApp: deep link con mensaje pre-redactado (nombre, fecha, monto, solicitud comprobante)
- Calendar: etiquetar slots no disponibles como "Ocupado"

### Out of Scope
- Múltiples servicios por reserva (postergado)
- Vencimiento automático a 15 días (§4)
- Notificaciones automáticas por WhatsApp (§5)
- Autenticación admin (§3.B)

## Capabilities

### New Capabilities
- `online-booking`: flujo completo de reserva pública desde selección hasta pantalla de pago y WhatsApp

### Modified Capabilities
- None (gestion-clientes no cambia; online-booking es nueva)

## Approach

- Backend: agregar `cbu` y `alias` a `Configuracion` → migración automática de schema + seed. Schemas `ConfiguracionUpdate` y `ConfiguracionRead` heredan los campos. Admin panel extiende formulario.
- Frontend: refactor `Reservar.tsx` con state `step: 1|2|3|4`:
  1. Selección servicio (existente)
  2. Datos cliente + DNI + calendario (agregar DNI)
  3. Resumen confirmación con detalle precios y datos ingresados. Botón "Confirmar turno"
  4. Pantalla éxito con datos bancarios + botón WhatsApp
- WhatsApp: `https://wa.me/{whatsapp_number}?text={encodeURIComponent(mensaje)}`
- Calendar: cambiar texto de slot no disponible a "Ocupado"

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/app/models.py` | Modified | +`cbu`, `alias` en Configuracion |
| `backend/app/schemas.py` | Modified | Idem en ConfiguracionUpdate/Read |
| `backend/app/main.py` | Modified | Seed values for new config fields |
| `frontend/src/pages/Reservar.tsx` | Modified | Refactor multi-step + DNI + resumen + payment screen |
| `frontend/src/components/Calendar.tsx` | Modified | "Ocupado" label for unavailable slots |
| `frontend/src/pages/Admin.tsx` | Modified | CBU/Alias inputs in config panel |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| CBU/Alias vacíos → payment screen sin datos | Medium | Fallback text: "Consultá por WhatsApp" |
| WhatsApp number no configurado | Low | Ocultar botón, mostrar mensaje alternativo |
| DNI no ingresado → booking roto (ya hoy) | High (live) | Incluir campo DNI obligatorio en step 2 |

## Rollback Plan

Revert `models.py`, `schemas.py`, `main.py` config fields. Revert `Reservar.tsx` y `Calendar.tsx`. Revert `Admin.tsx`. Sin migración de datos (nuevos campos opcionales).

## Dependencies

None.

## Success Criteria

- [ ] Booking crea cliente + cita con DNI incluido
- [ ] Pantalla post-creación muestra datos bancarios del negocio y monto seña
- [ ] Botón WhatsApp abre con mensaje pre-redactado conteniendo nombre, fecha, total, seña
- [ ] Calendar muestra "Ocupado" en slots no disponibles
- [ ] Admin puede editar CBU/Alias desde panel de configuración
