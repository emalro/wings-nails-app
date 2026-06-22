# ARCHITECTURE.md

## Propósito
Este documento describe la arquitectura conceptual del sistema de citas para estudio de uñas. El objetivo es definir cómo se organiza el sistema para cumplir los requisitos sin hacer referencia a tecnologías, frameworks o stacks específicos.

## Alcance
Incluye la organización de componentes, las relaciones entre módulos, el modelo de dominio principal, y las reglas de interacción entre las partes del sistema. No debe contener detalles de implementación tecnológica.

## Componentes principales
- Publico: landing page y flujo de reserva online.
- Interno: panel administrativo para la manicurista.
- Datos: estructura de dominio que soporta clientes, servicios, citas y reservas.
- Procesos automatizados: vencimientos, alertas y conciliación de pagos.
- Integraciones de experiencia: mapas de ubicación, notificaciones y envío de comprobantes.

## Modelo de dominio
- `Clientas`: datos de contacto, historial de turnos, asistencias y cancelaciones.
- `Servicios`: catálogo con duración, precio, monto de seña y estado de visibilidad.
- `Citas`: reservas con estado, precio histórico, seña, comprobante y método de pago.
- `Citas_Servicios`: asociación que permite múltiples servicios por reserva, con duración y subtotales.

## Estados y transiciones
- Estados principales: `Pendiente`, `Confirmado`, `Asistido`, `Cancelado_Cliente`, `Cancelado_Sistema_Vencimiento`.
- Transiciones clave:
  - `Pendiente` → `Confirmado` al validar pago o comprobante manual.
  - `Confirmado` → `Asistido` al completar el servicio.
  - `Pendiente` / `Confirmado` → `Cancelado_Cliente` por cancelación de la clienta.
  - `Pendiente` → `Cancelado_Sistema_Vencimiento` cuando la seña no se valida a 15 días.

## Interacciones de usuario
- Cliente pública:
  - visualiza disponibilidad genérica (`Ocupado` / `Disponible`)
  - selecciona servicios y fecha/hora
  - registra nombre, apellido y teléfono
  - recibe resumen de costo y estado `Pendiente`
  - envía comprobante de pago por mensaje pre-redactado
- Administradora:
  - accede al panel seguro
  - gestiona catálogo, configuraciones y agenda
  - aprueba pagos manuales y valida comprobantes
  - marca turnos asistidos y calcula saldos

## Reglas de negocio clave
- La vista pública no expone datos personales.
- Las reservas online se realizan con transferencia y quedan en `Pendiente` hasta validación.
- Solo se permiten turnos web con más de 15 días de anticipación.
- Cancelaciones dentro de 48 horas retienen la seña.
- La manicurista puede validar pagos manuales y dejar una nota de auditoría.

## No funcionales de arquitectura
- Mobile-first y accesibilidad para el flujo público.
- Privacidad en la vista pública y seguridad en el panel interno.
- Consistencia del estado de la agenda y bloqueo de concurrencia temporal.
- Mantenibilidad de los componentes y claridad del diseño.

## Relación con otros documentos
- `REQUIREMENTS.md`: define el qué del sistema.
- `ARCHITECTURE.md`: define el cómo sin tecnología.
- `DOCUMENTATION.md`: registra cambios, decisiones y justificaciones.
- `AGENTS.md`: guía al agente sobre roles, responsabilidades y disciplina documental.

## Notas del agente
- Mantener este documento actualizado con decisiones arquitectónicas relevantes.
- Evitar cualquier mención de lenguaje, base de datos, framework o herramienta específica.
- Referenciar requisitos específicos cuando se describe una regla o interacción.
