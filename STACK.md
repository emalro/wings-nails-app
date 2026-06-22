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
| Capa | Tecnología | Propósito |
|------|-----------|-----------|
| Backend | Python 3.11+ · FastAPI · SQLModel | API REST con tipado fuerte, validación Pydantic y ORM |
| Base de datos | SQLite (dev), a definir en producción | Persistencia embedida sin servidor externo |
| Frontend | React 18 · TypeScript 5.2 (strict) · Vite 8 | SPA con type-safe, HMR rápido y build optimizado |
| HTTP Client | TanStack Query 5 + axios | Caché automática, refetch en mutaciones, fetching declarativo |
| Calendario | react-big-calendar | Vista day/week/month con colores por estado de turno |
| UI/Routing | react-router-dom 6 | Navegación SPA con layouts anidados |
| Fechas | date-fns 4 | Manipulación liviana de fechas, locale argentino |

## Herramientas de desarrollo
| Herramienta | Versión | Uso |
|------------|---------|-----|
| Git | — | Control de versiones, feature branches desde main |
| pip | — | Gestor de dependencias Python |
| pytest | 7.0+ | Tests de integración backend (36 tests) |
| npm | — | Gestor de dependencias frontend |
| TypeScript | 5.2+ | Type-check en CI (`tsc --noEmit`) |
| Docker | multi-stage | Imagen producción: node build + python runtime |
| GitHub Actions | CI + CD | Automatización de tests, build y deploy |
| GitHub Container Registry | ghcr.io | Registro de imágenes Docker

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
