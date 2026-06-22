# STACK.md

## Propósito
Este documento describe las tecnologías y herramientas seleccionadas para el proyecto. También explica el motivo de cada elección y cómo esas tecnologías habilitan las funcionalidades clave del sistema.

## Uso
- `REQUIREMENTS.md` sigue siendo la especificación funcional agnóstica.
- `ARCHITECTURE.md` describe la organización conceptual del sistema.
- `STACK.md` documenta el stack tecnológico y justifica cada feature en términos de implementación y valor.
- `DOCUMENTATION.md` registra decisiones, cambios y resultados de implementación.

## Estructura recomendada
- Tecnologías principales
- Herramientas de desarrollo
- Justificación por feature
- Riesgos y mitigaciones
- Notas de integración

## Tecnologías principales
- Frontend: [Nombre del framework / librería] para la interfaz pública y panel administrativo.
- Backend: [Nombre del lenguaje / plataforma] para la lógica de negocio y las APIs.
- Base de datos: [Nombre del sistema de almacenamiento] para persistencia de clientes, servicios y citas.
- Almacenamiento de archivos: [Nombre de la solución] para comprobantes y medios.
- Integraciones: [API de WhatsApp], [servicio de mapas], [servicio de correo].

## Herramientas de desarrollo
- Control de versiones: Git.
- Gestión de dependencias: [Herramienta].
- Pruebas: [Framework de pruebas].
- Entorno local: [Herramienta de entorno / contenedores].

## Justificación por feature
Para cada feature importante, documentar:
- Qué se implementa
- Por qué es necesario
- Cómo se implementa
- Qué entradas/salidas tiene
- Qué impacto tiene en la experiencia de usuario o en el negocio

### Ejemplo
Feature: Reserva online con pago por transferencia
- Qué: flujo de selección de servicio, calendario público y formulario de reserva.
- Por qué: permite a las clientas solicitar turnos de forma autónoma y protege la agenda con una seña.
- Cómo: formulario cliente + validación de disponibilidad + estado `Pendiente` hasta pago/validación.
- Impacto: reduce trabajo manual, mejora transparencia y disminuye doble reserva.

## Riesgos y mitigaciones
- Riesgo: exposición de datos personales en la vista pública.
  - Mitigación: mostrar solo bloques genéricos "Ocupado" / "Disponible".
- Riesgo: pérdida de disponibilidad por reservas simultáneas.
  - Mitigación: bloqueo transaccional temporal durante el flujo de reserva.

## Notas de integración
- Detallar cómo se conectan las piezas entre sí.
- Registrar dependencias externas y formatos de datos importantes.

## Actualización del documento
- Este archivo debe actualizarse cada vez que se introduzca una nueva tecnología o se agregue una justificación de feature importante.
- Cualquier cambio de stack debe reflejarse también en `DOCUMENTATION.md`.
