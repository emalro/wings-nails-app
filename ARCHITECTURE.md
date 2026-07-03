# ARCHITECTURE.md

> Última actualización: 22/06/2026

## Propósito
Este documento describe la arquitectura conceptual del sistema de citas para estudio de uñas. El objetivo es definir cómo se organiza el sistema para cumplir los requisitos sin hacer referencia a tecnologías, frameworks o stacks específicos.

## Alcance
Incluye la organización de componentes, las relaciones entre módulos, el modelo de dominio principal, y las reglas de interacción entre las partes del sistema. No debe contener detalles de implementación tecnológica.

## Componentes principales
- **Público**: landing page y flujo de reserva online. Muestra información del negocio (dinámica desde configuración) y permite a clientas reservar turnos con disponibilidad en tiempo real.
- **Administración**: panel interno para la manicurista. Incluye agenda visual, gestión de servicios, configuración del negocio, horarios de atención, y carga manual de citas.
- **Búsqueda Predictiva de Clientes**: módulo de búsqueda por nombre, apellido o teléfono con resultado instantáneo, usado desde la carga manual de citas.
- **Gestión de Horarios**: define la disponibilidad semanal por defecto y permite excepciones puntuales (feriados, cambios temporales). Alimenta el cálculo de horario efectivo para todos los calendarios.
- **Datos**: estructura de dominio que soporta clientes, servicios, citas, horarios, excepciones y configuración del negocio.
- **Procesos automatizados**: vencimientos, alertas y conciliación de pagos (pendiente de implementar).
- **Integraciones de experiencia**: mapas de ubicación, notificaciones y envío de comprobantes (pendiente de implementar).
- **Contenido estático del Home (home-static-content)**: secciones informativas de la landing page gestionadas desde administración — Sobre mí, Cómo reservar, Testimonios, FAQ — con contenido editable (texto, imágenes, orden, estado activo) que se renderiza públicamente sin lógica de negocio compleja.

## Modelo de dominio
- `Clientas`: datos de contacto (`nombre`, `apellido`, `teléfono`), historial de turnos tomados, abonados y cancelados. Cuenta con índice de búsqueda para autocompletado predictivo.
- `Servicios`: catálogo con duración, precio, monto de seña, descripción y estado de visibilidad (activo/inactivo). Los servicios inactivos no se muestran al público.
- `Citas`: reserva transaccional con fecha/hora, cliente, precio histórico cobrado, seña histórica pagada, comprobante, método de pago, estado, y monto recibido en caja.
- `Citas_Servicios`: asociación N:N que permite múltiples servicios por reserva, cada uno con su duración, precio unitario y subtotal.
- `HorarioSemanal`: configuración día por día (activo, hora apertura, hora cierre) para la semana laboral estándar.
- `ExcepciónHorario`: anulación o modificación puntual del horario para una fecha específica (ej: feriado, media jornada).
- `Configuración`: parámetros editables del negocio (nombre, redes sociales, WhatsApp, dirección) que se renderizan dinámicamente en la landing page.
- `Galería`: hasta 6 slots de imágenes administrables (orden, url, alt text, link opcional, activo) que se renderizan como grilla en la landing page. La unicidad de `orden` aplica sólo entre filas activas (la convivencia de inactivos en el mismo orden está permitida).

## Estados de Cita y transiciones
- Estados principales: `Pendiente`, `Confirmado`, `Asistido`, `Cancelado_Cliente`, `Cancelado_Sistema_Vencimiento`.
- Transiciones clave:
  - `Pendiente` → `Confirmado` al validar pago o comprobante manual.
  - `Confirmado` → `Asistido` al completar el servicio.
  - `Pendiente` / `Confirmado` → `Cancelado_Cliente` por cancelación de la clienta.
  - `Pendiente` → `Cancelado_Sistema_Vencimiento` cuando la seña no se valida a 15 días.
- Las cargas manuales pueden crear citas directamente en `Confirmado` saltando la validación de seña.

## Interacciones de usuario
- **Cliente pública**:
  - visualiza landing page con datos dinámicos del negocio
  - visualiza disponibilidad genérica (`Ocupado` / `Disponible`) sin datos personales
  - selecciona servicios y fecha/hora
  - registra nombre, apellido y teléfono
  - recibe resumen de costo, seña calculada y estado `Pendiente`
  - envía comprobante de pago por mensaje pre-redactado vía WhatsApp
- **Administradora**:
  - accede al panel seguro (autenticación pendiente)
  - visualiza agenda en calendario interactivo con códigos de color por estado
  - gestiona catálogo de servicios (alta, baja, modificación, visibilidad)
  - actualiza configuración del negocio (nombre, redes, WhatsApp, dirección)
  - **busca clientas** con buscador predictivo por nombre o teléfono
  - **carga turnos manualmente** con estado Confirmado o Efectivo opcional, bloqueando la agenda al instante
  - gestiona horarios semanales y excepciones puntuales
  - edita citas existentes (reprogramar, ajustar precios, método de pago)
  - aprueba pagos manuales y valida comprobantes
  - marca turnos como asistidos con desglose contable (precio - seña = saldo)

## Reglas de negocio clave
- La vista pública no expone datos personales de las clientas; solo bloques genéricos "Ocupado".
- Las reservas online se realizan con transferencia y quedan en `Pendiente` hasta validación de seña.
- Las cargas manuales pueden omitir la seña y crear la cita directamente como `Confirmado` o con pago en Efectivo.
- Solo se permiten turnos web con más de 15 días de anticipación.
- Cancelaciones dentro de 48 horas retienen la seña.
- La manicurista puede validar pagos manualmente y dejar registro de auditoría.
- El horario de atención se compone de: plantilla semanal + excepciones por fecha (las excepciones tienen prioridad).
- La búsqueda de clientas requiere mínimo 2 caracteres y devuelve máximo 10 resultados.

## No funcionales de arquitectura
- Mobile-first y accesibilidad para el flujo público.
- Privacidad en la vista pública y seguridad en el panel interno.
- Consistencia del estado de la agenda y bloqueo de concurrencia en creación de citas.
- Latencia de búsqueda de clientas < 300ms.
- Mantenibilidad de los componentes y claridad del diseño.

## Relación con otros documentos
- `REQUIREMENTS.md`: define el qué del sistema.
- `ARCHITECTURE.md`: define el cómo sin tecnología.
- `DOCUMENTATION.md`: registra cambios, decisiones y justificaciones.
- `AGENTS.md`: guía al agente sobre roles, responsabilidades y disciplina documental.
- `STACK.md`: detalla tecnologías concretas y justificación de cada elección.

## Notas del agente
- Mantener este documento actualizado con decisiones arquitectónicas relevantes.
- Evitar cualquier mención de lenguaje, base de datos, framework o herramienta específica.
- Actualizar cuando se agreguen nuevos dominios (ej: notificaciones, dashboard, autenticación).
- Referenciar requisitos específicos cuando se describe una regla o interacción.
