# AGENTS.md

## Propósito
Este documento define las responsabilidades del agente que trabaja en el proyecto del sistema de citas para estudio de uñas. Su objetivo es mantener el proceso disciplinado, documentado y alineado con la metodología SDD.

## Uso de `REQUIREMENTS.md`
- `REQUIREMENTS.md` se usa como el documento de requerimientos funcionales y no debe incluir ninguna tecnología, framework o stack.
- El agente debe tratarlo exclusivamente como especificación de negocio y comportamiento.
- Cualquier decisión de implementación técnica debe permanecer fuera de `REQUIREMENTS.md` y registrarse en `DOCUMENTATION.md`.

## Uso de `ARCHITECTURE.md`
- `ARCHITECTURE.md` describe la organización conceptual del sistema y debe permanecer libre de tecnologías específicas.
- El agente debe usarlo para traducir los requisitos funcionales en componentes, flujos y modelos de dominio.
- Las decisiones arquitectónicas relevantes deben ser anotadas aquí antes de pasar a la implementación.

## Uso de `STACK.md`
- `STACK.md` documenta las tecnologías, herramientas y razones de selección para el proyecto.
- El agente debe justificar por qué cada feature se implementa con ese stack y cómo cada tecnología contribuye al valor del producto.
- Cualquier cambio en el stack o la incorporación de nuevas herramientas debe registrarse aquí y en `DOCUMENTATION.md`.

## Responsabilidades del agente
1. Leer y respetar los requerimientos funcionales y no funcionales.
2. Proponer una arquitectura y diseño basado en esos requerimientos, sin asumir tecnología específica.
3. Documentar cada cambio que se haga en el proyecto.
4. Mantener el registro de decisiones, cambios y justificaciones en `DOCUMENTATION.md`.
5. Validar que las modificaciones cumplan con los criterios de aceptación y con la tradición SDD.

## Normas de documentación
- Antes de implementar un cambio, el agente debe registrar la intención en `DOCUMENTATION.md`.
- Al completar cualquier cambio, el agente debe documentar:
  - Fecha del cambio
  - Autor o agente responsable
  - Descripción de qué se cambió
  - Archivos y componentes afectados
  - Motivo / razón del cambio
  - Referencia a los requisitos relevantes
  - Impacto previsto
- Las notas de diseño y las suposiciones deben quedar documentadas en `DOCUMENTATION.md`.

## Cómo avanzar
1. Usar `REQUIREMENTS.md` como punto de partida para entender el negocio.
2. Generar los artefactos de diseño necesarios: diagramas, entidades, flujos y reglas.
3. Registrar la implementación en `DOCUMENTATION.md` antes y después del cambio.
4. Mantener `REQUIREMENTS.md` libre de detalles de implementación y tecnología.

## Sugerencias de estructura para el agente
- Incluir un índice mínimo de actividades: análisis, diseño, implementación, pruebas, verificación.
- Señalar claramente si un cambio responde a una corrección, una mejora o una nueva funcionalidad.
- Siempre conservar trazabilidad entre la acción y el requisito original.
