# DOCUMENTATION.md

## Propósito
Este documento captura el historial de cambios, decisiones de diseño y consideraciones de implementación del proyecto. Debe ser usado como el registro oficial del agente para documentar cada intervención.

## Formato de registro de cambios
Cada entrada de cambio debe incluir:
- Fecha
- Autor / agente responsable
- Tipo de cambio (Nueva funcionalidad, Corrección, Mejora, Documentación)
- Descripción breve
- Archivos afectados
- Requisitos relacionados
- Motivo / justificación
- Impacto esperado

### Plantilla de entrada
```
Fecha: 2026-06-20
Autor: Agente
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

## Ejemplo inicial de historial
Fecha: 2026-06-20
Autor: Agente
Tipo de cambio: Inicial
Descripción: Se creó el documento `DOCUMENTATION.md` como registro obligatorio de cambios para el proyecto.
Archivos afectados: DOCUMENTATION.md
Requisitos relacionados: Documento de control de cambios
Motivo: Establecer un seguimiento formal de las modificaciones.
Impacto esperado: Facilitar auditoría de cambios y continuidad del proyecto.


Fecha: 2026-06-20
Autor: Agente
Tipo de cambio: MVP scaffold
Descripción: Se inició el MVP con backend FastAPI y frontend React+Vite. Se añadieron endpoints básicos (`/clients`, `/services`, `/appointments`) y la UI de reserva mínima.
Archivos afectados: backend/app/*, backend/tests/*, backend/Dockerfile, frontend/*
Requisitos relacionados: REQ-1 (flujo de reserva público), REQ-2 (panel admin placeholder), REQ-4 (vencimientos rule set)
Motivo: Entregar un prototipo funcional para iterar sobre integraciones y UX.
Impacto esperado: Permite crear clientas, listar servicios y solicitar reservas en un flujo extremo mínimo.
