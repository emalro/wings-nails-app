# Documento de Requerimientos: Sistema de Citas para Estudio de Uñas

>Última revisión: 23/06/2026

## Índice

- ✅ = Implementado

1. [Objetivo del Sistema](#1-objetivo-del-sistema)
2. [Arquitectura de Vistas Públicas (Módulo de Clientas)](#2-arquitectura-de-vistas-públicas-módulo-de-clientas)
    1. [Raíz de la Aplicación Web: Landing Page](#a-raíz-de-la-aplicación-web-landing-page)
     2. ✅ [Flujo de Reserva Online (/reservar)](#b-flujo-de-reserva-online-reservar)
3. [Requerimientos Funcionales: Módulo de Administración](#3-requerimientos-funcionales-módulo-de-administración)
    1. ✅ [Gestión de Parámetros del Negocio y Redes (ABM Configuración)](#a-gestión-de-parámetros-del-negocio-y-redes-abm-configuración)
    2. [Autenticación y Seguridad](#b-autenticación-y-seguridad-de-la-manicurista)
    3. ✅ [Gestión de Catálogo de Servicios](#c-gestión-de-cátalogo-de-servicios)
    4. ✅ [Carga Manual de Citas y Buscador Predictivo](#d-carga-manual-de-citas-y-buscador-predictivo)
    5. ✅ [Control de Agenda y Estados Visuales](#e-control-de-agenda-y-estados-visuales)
    6. [Panel de Métricas y Dashboard Administrativo](#f-panel-de-métricas-y-dashboard-administrativo)
4. [Lógica de Vencimientos, Reglas de Negocio y Mitigaciones](#4-lógica-de-vencimientos-reglas-de-negocio-y-mitigaciones)
5. [Módulo de Notificaciones y Alertas Automáticas](#5-módulo-de-notificaciones-y-alertas-automáticas)
6. ✅ [Estructura de la Base de Datos (Diseño en 3FN)](#6-estructura-de-la-base-de-datos-diseño-en-3fn)
7. [Requerimientos No Funcionales](#7-requerimientos-no-funcionales)

## 1. Objetivo del Sistema
Desarrollar una aplicación web responsive (Landing Page + Sistema de Gestión de Reservas) que permita a las clientas conocer el salón y solicitar turnos de manicuría de forma autónoma. El sistema dejará el turno en estado "Pendiente" hasta que la clienta envíe el comprobante de transferencia bancaria (o valide pago en efectivo), permitiendo a la manicurista aprobarlo manualmente. Centralizará la agenda, permitirá la gestión de servicios/redes y automatizará el control de vencimientos de señas para proteger la agenda de la manicurista.

---

## 2. Arquitectura de Vistas Públicas (Módulo de Clientas)

### A. Raíz de la Aplicación Web: Landing Page
La página de inicio (/) actuará como la vitrina del negocio y estará estructurada en las siguientes secciones secuenciales:

1.  *Navbar (Barra de Navegación):*
    *   Izquierda: Logo del emprendimiento (imagen) seguido del Nombre del Emprendimiento (texto).
    *   Derecha: Botón destacado "Reservar Turno" (redirecciona al Calendario General), Botón con ícono de WhatsApp, Botón con ícono de Instagram y Botón con ícono de Facebook.
    *   Dinamismo: Los enlaces de las tres redes sociales y el nombre/logo del emprendimiento deben consumirse dinámicamente desde las variables configuradas en el Panel Administrador.
2.  *Sección de Introducción:* Bloque principal (Hero Section) con una imagen estética de fondo, título de bienvenida y una breve descripción introductoria de la propuesta de valor del estudio de uñas.
3.  *Sección de Servicios:* Despliegue automatizado del catálogo en formato de *Cards (Tarjetas)*. Cada tarjeta mostrará el Nombre del Servicio, Duración, Precio, Monto de la Seña y Descripción. Solo se renderizarán los servicios que tengan el estado activo: True.
4.  *Sección de Trabajos Realizados (Carrusel):* Slider de imágenes interactivo y responsive que permitirá visualizar fotos de diseños y trabajos previos realizados por la manicurista.
5.  *Sección Call To Action (CTA):* Bloque visual de alto contraste con el texto principal: "¿Necesitás hacerte las uñas?" acompañado de un botón de gran tamaño que redirija directamente al flujo de reserva de turnos.
6.  *Sección de Ubicación:* Contenedor que renderiza un minimapa embebido de Google Maps. La dirección de origen utilizada para cargar el mapa debe ser configurable por la manicurista desde el Panel de Administración.
7.  *Footer (Pie de Página):* Estructura de una sola línea con distribución horizontal:
    *   Alineado a la Izquierda: Texto con formato estricto: © — 2026 [Nombre del Emprendimiento] Rosario, Santa Fe. (El año se calcula dinámicamente según la fecha actual del sistema).
    *   Alineado a la Derecha: Accesos directos a los canales de contacto representados *únicamente por sus íconos visuales* (WhatsApp, Instagram, Facebook), sin textos adjuntos.

### B. ✅ Flujo de Reserva Online (/reservar)

#### REQ-BKG-001 — CBU/Alias en Configuración (MUST)
El modelo `Configuracion` DEBE incluir `cbu_alias` y `cbu_number`. Los schemas `ConfiguracionUpdate` y `ConfiguracionRead` DEBEN exponerlos. El panel admin DEBE permitir visualizarlos y editarlos. Si ambos están vacíos, la pantalla de pago DEBE mostrar "Consultá por WhatsApp".

#### REQ-BKG-002 — Flujo Multi-Step (MUST)
La reserva DEBE tener 4 pasos secuenciales: (1) selección de uno o más servicios (toggle, múltiple), (2) datos del cliente (nombre, apellido, teléfono, DNI) + calendario, (3) resumen con servicios, duración total, total, seña y datos ingresados + botón "Confirmar turno", (4) pantalla de pago con CBU/Alias y monto de seña. El formulario DEBE mostrar errores de validación inline por campo (DNI, teléfono, campos obligatorios) y el calendario DEBE mostrar mensajes específicos según el motivo de indisponibilidad (cerrado, sin horario suficiente, todos ocupados).

*   *Calendario Dinámico:* Selección de fecha y hora disponibles en tiempo real, calculados automáticamente según la duración del servicio elegido.
*   *Visibilidad Pública de Turnos:* En la vista pública de disponibilidad, los horarios ocupados se muestran como bloques genéricos "Ocupado" sin datos personales de las clientas.
*   *Formulario de Datos:* Registro rápido con Nombre, Apellido, Teléfono (WhatsApp) y DNI.
*   *Experiencia Pública de Reserva:* El flujo de reserva debe mostrar de forma clara el servicio seleccionado, el monto total, la seña calculada y los pasos necesarios para completar la transferencia. Debe incluir un resumen final antes de confirmar que el turno quedará en estado "Pendiente" hasta la validación del comprobante.

#### REQ-BKG-003 — WhatsApp Payment Receipt (MUST)
La pantalla de pago DEBE incluir botón WhatsApp con mensaje pre-redactado. El link DEBE abrir `https://wa.me/{whatsapp_number}` con mensaje codificado incluyendo nombre, fecha/hora, servicio y monto de seña. Si `whatsapp_number` está vacío, el botón DEBE ocultarse y mostrar texto alternativo de contacto.

*   *Botón de Envío de Comprobante:* Redirección con texto pre-redactado para enviar la foto del comprobante de transferencia a través de la API de WhatsApp.
*   *Pantalla de Pago Manual:* Muestra los datos de la cuenta bancaria (CBU/Alias) y el monto de la seña requerida para ese servicio. Las reservas online solo se completan con transferencia bancaria; la opción de "Efectivo" no está disponible para nuevas clientas en el flujo web autónomo y solo puede habilitarse en registros manuales según políticas internas.

#### REQ-BKG-004 — DNI en Formulario (MUST)
El formulario de reserva DEBE incluir campo `dni` obligatorio en paso 2. El payload a `POST /clients` DEBE incluirlo (el backend ya lo exige).

#### REQ-BKG-005 — Privacy Labels (MUST)
Los slots ocupados en el calendario público DEBEN mostrar el texto "Ocupado" en lugar de la hora. El calendario DEBE incluir un mensaje explicativo de privacidad sobre protección de datos personales.

*   *Privacidad y Transparencia en el Calendario Público:* La vista pública solo debe mostrar bloques genéricos "Ocupado" o "Disponible" sin datos personales de las clientas, sin indicar nombres, servicios ni montos. Debe acompañarse de un mensaje explicativo que aclare que los horarios ocupados ya están reservados y que los datos personales se protegen por privacidad.
*   *Accesibilidad y Mobile First:* El flujo de reserva debe ser totalmente usable en dispositivos móviles, con botones táctiles grandes, confirmaciones visibles y mensajes de error sensibles al contexto de la carga de comprobantes.

---

## 3. Requerimientos Funcionales: Módulo de Administración (Panel de la Manicurista)

### A. Gestión de Parámetros del Negocio y Redes (ABM Configuración)
Permite a la manicurista actualizar la información que se renderiza directamente en la Landing Page sin necesidad de tocar código:
*   *Campos de Contacto:* Inputs de texto para actualizar las URLs completas de Facebook, Instagram y el número telefónico para el enlace API de WhatsApp.
*   *Dirección del Local:* Input de texto para actualizar la dirección física que alimenta al minimapa de Google Maps.

### B. Autenticación y Seguridad de la Manicurista
El acceso al panel de administración requiere autenticación segura para el rol de la manicurista:
*   *Cuenta de Empresa:* Usuario tipo email de dominio, por ejemplo `admin@<dominio>`.
*   *Contraseña Segura:* Contraseña con reglas de complejidad y expiración configurable.
*   *Recuperación de Cuenta:* Opción de recuperación de contraseña por email.
*   *Control de Sesiones:* Gestión de sesiones activas y cierre de sesión seguro.
*   *Roles y Permisos:* Solo los usuarios administrativos autenticados pueden ver datos personales de clientas y aprobar reservas.

### C. Gestión de Catálogo de Servicios
Panel ABM (Alta, Baja, Modificación) de servicios con los siguientes atributos obligatorios:
*   *Nombre del Servicio, **Duración Estimada* (en bloques de 15/30 min), *Precio Total, **Monto de Seña Exigido* y *Descripción*.
*   *Estado de Visibilidad:* Switch Activo/Inactivo para controlar su renderizado en las Cards de la Landing Page.

### D. Carga Manual de Citas y Buscador Predictivo
*   *Registro Express:* Buscador predictivo por nombre/teléfono. Si la clienta es nueva, permite registrar su ficha en el acto.
*   *Bloqueo de Agenda:* Al cargar la cita manual (marcando opcionalmente el estado como Confirmado o Efectivo en el Local), el sistema bloquea inmediatamente la franja horaria en la vista pública para prevenir concurrencia.

### E. Control de Agenda y Estados Visuales
Calendario administrativo interactivo organizado por código de colores según el estado transaccional de la cita:
*   Amarillo: Pendiente de seña.
*   Verde: Señado / Confirmado.
*   Gris con Check: Asistido.
*   *Visibilidad Diferenciada:* La manicurista podrá ver los datos de la clienta y la información completa del turno en el panel interno. La vista pública de disponibilidad mostrará únicamente bloques "Ocupado" para los horarios ocupados, sin exponer información personal.
*   *Botón "Marcar como Asistido":* Al finalizar el servicio presencial, la manicurista presiona este botón sobre el turno correspondiente. El sistema despliega una ventana emergente con el desglose contable (Precio Histórico - Seña Pagada = Saldo Restante a cobrar en mano) y, al confirmar, cierra la transacción sumando +1 a la asistencia de la clienta.

### F. Panel de Métricas y Dashboard Administrativo
El panel interno debe incluir un dashboard de métricas operativo que permita a la manicurista monitorear el negocio y actuar rápidamente sobre turnos críticos:
*   *Resumen KPI Inicial:* tarjetas con valores de Tasa de Asistencia, Reservas Confirmadas, Turnos Cancelados < 48h, Ingresos por Seña Retenida, Ocupación Semanal y Clientes Reincidentes.
*   *Filtro y Búsqueda:* filtros por fecha, estado de turno, método de pago, nombre de clienta y presencia de comprobante.
*   *Alertas Visuales:* avisos destacados para turnos pendientes sin comprobante, cancelaciones recientes dentro de 48 horas y clientes con reincidencias de cancelación.
*   *Acciones Rápidas:* botones para aprobar turno, marcar pago verificado manualmente, reprogramar o cancelar con motivo desde la vista de detalle.
*   *Detalle de Turno:* cada reserva debe mostrar cliente, teléfono, servicios incluidos, duración total, precio histórico, seña histórica, comprobante adjunto, notas de verificación y estado actual.
*   *Actualización de Datos:* las métricas se deben actualizar al menos cada vez que una cita cambie de estado o se registre un pago, manteniendo dashboards consistentes con la agenda.

## 4. Lógica de Vencimientos, Reglas de Negocio y Mitigaciones

### 4.1 Reglas de Negocio Generales

*   *Reservas Online con Transferencia Exclusiva:* Las reservas web solo pueden completarse con pago por transferencia bancaria. El estado de la cita queda en "Pendiente" hasta que se reciba y valide el comprobante de transferencia.
*   *Agregado de Varios Servicios y Suma de Precios:* El sistema debe permitir seleccionar múltiples servicios en una sola reserva. El precio total de la cita será la suma de los precios históricos de cada servicio seleccionado, y la seña se calcula sobre este total según la política vigente.
*   *Ingreso Manual de Dinero Recibido:* El sistema debe permitir registrar manualmente el monto efectivamente recibido en caja al finalizar la atención, de modo que los ingresos reales puedan cuadrarse con el sistema y evitar mismatches de caja.
*   *Política de Cancelación y Retención de Seña:* Las cancelaciones de turnos son aceptadas, pero si la cancelación ocurre dentro de las 48 horas previas al turno, la seña no se devuelve. En ese caso, el turno se marca como "Cancelado_Cliente" y la seña se retiene como penalización.
*   *Validación de Pago sin Comprobante:* Si la clienta no envía el comprobante por WhatsApp, la manicurista puede validar el pago manualmente mediante homebanking o billetera y aprobar el turno. Esta excepción debe registrar la verificación manual y el motivo de la aprobación.

### 4.2 Estados de Cita y Transiciones

*   *Estados:* `Pendiente`, `Confirmado`, `Asistido`, `Cancelado_Cliente`, `Cancelado_Sistema_Vencimiento`.
*   *Transiciones:* `Pendiente` → `Confirmado` al validar el pago o la comprobación manual. `Confirmado` → `Asistido` al completar el servicio. `Pendiente` / `Confirmado` → `Cancelado_Cliente` en cancelaciones del cliente. `Pendiente` → `Cancelado_Sistema_Vencimiento` cuando no se valida la seña a 15 días del turno.
*   *Validación Manual:* La manicurista debe registrar cuándo un pago fue verificado manualmente, y el sistema debe conservar esa marca como auditoría.

### 4.3 Transferencias, Comprobantes y Conciliación

*   *Recepción de Comprobante:* El sistema debe permitir adjuntar y almacenar el comprobante de transferencia enviado por la clienta.
*   *Verificación Manual:* Si no se recibe comprobante, el pago puede ser validado manualmente por la manicurista en homebanking o billetera. En ese caso, el sistema guarda `comprobante_verificado_manual = true` y una nota de verificación.
*   *Conciliación de Pagos:* El sistema debe comparar el monto de seña esperado con el monto del comprobante y con el ingreso manual registrado en caja. Cualquier diferencia se anota para control de caja.

### 4.4 Múltiples Servicios y Detalle de Reserva

*   *Items de Servicio:* Cada reserva puede agrupar múltiples servicios con nombre, duración, precio unitario y subtotal.
*   *Duración Total:* La duración total de la cita se calcula como la suma de las duraciones de cada servicio y el calendario debe bloquear el tramo completo.
*   *Subtotal y Total:* El sistema muestra subtotal por servicio, total de la reserva y monto de la seña sobre el total.
*   *Conciliación de Caja:* Al finalizar el turno, la manicurista puede ingresar el dinero recibido en caja y registrar discrepancias, propinas o descuentos aplicados en mano.

### 4.5 Métricas y Dashboard

*   *Tasa de Asistencia:* Porcentaje de turnos completados respecto a turnos confirmados.
*   *Reservas Canceladas < 48h:* Cantidad de cancelaciones de cliente dentro del límite de 48 horas.
*   *Ingresos por Seña Retenida:* Total acumulado de señas retenidas por cancelaciones tardías.
*   *Ocupación Semanal:* Porcentaje de capacidad ocupada por semana.
*   *Clientes Reincidentes:* Indicador de clientas con 3 o más cancelaciones, señaladas como alerta de reincidencia.
*   *Alertas de Gestión:* Señales visuales cuando hay más de 3 turnos pendientes sin comprobante, o cuando la ocupación semanal supera el 80%.
*   *Actualización de Dashboard:* El sistema debe recalcular y refrescar las métricas en tiempo real con cada cambio de estado de cita, pago verificado, cancelación o ingreso de caja.
*   *Relación Métricas-Acción:* Cada métrica debe vincularse a acciones concretas: por ejemplo, click en "Reservas Canceladas < 48h" abre el listado de cancelaciones recientes; click en "Clientes Reincidentes" muestra registros de clientas con historial de cancelaciones.

### 4.6 Criterios de Aceptación

*   *Aceptación 1:* La vista pública muestra únicamente bloques "Ocupado" para horarios no disponibles y no revela datos personales.
*   *Aceptación 2:* La manicurista puede validar una reserva sin comprobante si verifica el pago manualmente en homebanking o billetera.
*   *Aceptación 3:* El sistema permite seleccionar múltiples servicios en una sola reserva y calcula la duración y el total correctos.
*   *Aceptación 4:* Las cancelaciones dentro de las 48 horas retienen la seña y marcan el turno como `Cancelado_Cliente`.
*   *Aceptación 5:* La autenticación del panel administrativo se realiza con email de dominio, contraseña segura y recuperación por email.

### 4.7 Reglas y Mitigaciones Específicas

*   *Regla 1 (Reubicación de Turnos Cancelados por Vencimiento):* Si un turno es cancelado automáticamente por no recibir la seña 15 días antes de la cita, el espacio se libera pero el registro permanece. Si la clienta presenta un comprobante válido después de la cancelación, el administrador podrá reubicar el turno cancelado en un nuevo horario respetando el saldo de su seña.
*   *Regla 2 (Reprogramaciones y Límite de 48 Horas):* Si la clienta solicita reprogramar el turno con más de 48 horas de antelación, se podrá mover la fecha y hora preservando la seña histórica pagada. Si la solicitud ocurre dentro de las 48 horas previas, la seña se retiene y la cita se marca como "Cancelado_Cliente".
*   *Regla 3 (Pago en Efectivo con Historial Requerido):* La opción de pago en efectivo no está disponible para nuevas clientas en el flujo web. Solo se habilita para clientas con historial de al menos 2 turnos abonados (`cantidad_turnos_abonados >= 2`) y siempre sujeto a coordinación directa o registro manual de la cita.
*   *Regla 4 (Cambio de Servicio en el Local):* Si la clienta cambia a un servicio más corto o económico al momento de la atención, el sistema permitirá ajustar el `id_servicio` antes de cerrar la transacción. Se debe recalcular el precio histórico cobrado y el saldo restante en mano, siguiendo las reglas de penalización por tiempo muerto establecidas por el salón.
*   *Regla 5 (Tardanzas e Inasistencias):* La tolerancia máxima es de 15 minutos para la clienta. Pasado ese tiempo, el turno deberá marcarse como "Cancelado_Cliente" con motivo "Ausencia", se retendrá la seña y se incrementará el contador de cancelaciones de la clienta.

*   *Restricción Base de Reserva Online:* El sistema solo permitirá solicitar un turno en estado "Pendiente de Seña" si la fecha elegida está a *más de 15 días de corrido* de distancia respecto al día actual.
*   *Bloqueo de Días Próximos:* Turnos solicitados para fechas dentro de los próximos 15 días requerirán coordinación directa vía WhatsApp (bloqueando la acción web autónoma).
*   *Vencimiento y Liberación Automática:* El sistema ejecutará un proceso automático diario. Si un turno llega al *día 15 previo a la cita* en estado "Pendiente de Seña", se cancelará de forma automática (Cancelado_Sistema_Vencimiento) y el bloque horario se liberará en el calendario público.

---

## 5. Módulo de Notificaciones y Alertas Automáticas

El sistema disparará recordatorios automatizados vía WhatsApp vinculados al ciclo de vida del turno "Pendiente de Seña":
*   *Alerta 1 (Día 22 previo a la cita - 1 semana antes del vencimiento):* "¡Hola [Nombre]! Te recordamos que tenés un turno reservado para el [Fecha] a las [Hora]. Para asegurar tu lugar, recordá realizar la transferencia de la seña esta semana. ¡Muchas gracias!"
*   *Alerta 2 (Día 16 previo a la cita - 24 horas antes del vencimiento):* "¡Hola [Nombre]! Tu reserva para el [Fecha] vencerá en 24 horas por falta de seña. Si ya realizaste la transferencia, por favor envianos el comprobante. De lo contrario, el sistema liberará el turno automáticamente."
*   *Alerta 3 (Día 15 previo a la cita - Notificación de Cancelación Automática):* "Hola [Nombre]. Te informamos que tu reserva para el [Fecha] a las [Hora] ha sido cancelada automáticamente ya que se cumplió el plazo límite de 15 días sin registrar el pago de la seña. Si deseas agendar nuevamente, podés consultar la disponibilidad en nuestra web."
*   *Alerta Interna 1 (Pendiente de Validación):* Notificación interna para la manicurista cuando un turno quedó en estado "Pendiente" sin comprobante recibido.
*   *Alerta Interna 2 (Seña No Confirmada):* Notificación interna para la manicurista cuando falta menos de 48 horas y la seña todavía no fue validada.

---

## 6. Estructura de la Base de Datos (Diseño en 3FN)

### Entidad: Clientes
*   id_cliente: INT (PK, Autoincremental).
*   fecha_creacion: DATETIME.
*   nombre: VARCHAR(50).
*   apellido: VARCHAR(50).
*   dni: VARCHAR(20) (UNIQUE, identificador único del sistema).
*   activo: BOOLEAN (por defecto TRUE; soft-delete si FALSE).
*   cantidad_turnos_tomados: INT.
*   cantidad_turnos_abonados: INT.
*   cantidad_turnos_cancelados_vencidos: INT.
*   Indicadores Dashboard: *Tasa de Asistencia* y *Alerta de Reincidencia* (Ficha en rojo si acumula 3 o más turnos caídos).

### Entidad: ClienteTelefono
*   id: INT (PK, Autoincremental).
*   id_cliente: INT (FK → Clientes.id_cliente).
*   telefono: VARCHAR(20) (normalizado a dígitos, indexado).
*   etiqueta: VARCHAR(100) (opcional, texto libre, ej: "Casa", "Trabajo").
*   es_principal: BOOLEAN (exactamente uno por cliente puede ser TRUE).

Nota: El teléfono se migró de la entidad Clientes a ClienteTelefono para soporte multi-teléfono (3FN). Al crear un cliente, el primer teléfono se almacena con `es_principal=true`. La búsqueda de clientes por teléfono cruza esta tabla.

### Entidad: Servicios
*   id_servicio: INT (PK, Autoincremental).
*   nombre_servicio: VARCHAR(100).
*   duracion_minutos: INT.
*   precio_actual: DECIMAL(10,2).
*   monto_sena_actual: DECIMAL(10,2).
*   descripcion: TEXT.
*   activo: BOOLEAN.

### Entidad: Citas (Tabla Transaccional)
*   id_cita: INT (PK, Autoincremental).
*   id_cliente: INT (FK).
*   id_servicio: INT (FK).
*   fecha_hora_cita: DATETIME.
*   precio_historico_cobrado: DECIMAL(10,2).
*   seña_historica_pagada: DECIMAL(10,2).
*   comprobante_transferencia_url: VARCHAR(255).
*   comprobante_verificado_manual: BOOLEAN.
*   monto_recibido_en_caja: DECIMAL(10,2).
*   estado_cita: ENUM ('Pendiente', 'Confirmado', 'Asistido', 'Cancelado_Cliente', 'Cancelado_Sistema_Vencimiento').
*   metodo_pago_seña: ENUM ('Transferencia', 'Efectivo', 'Ninguno').
*   fecha_registro_cita: DATETIME.

*   Nota: Para manejar múltiples servicios por reserva, se puede agregar una tabla intermedia `Citas_Servicios` que relacione `id_cita` con `id_servicio`, incluyendo `duracion_minutos`, `precio_unitario` y `subtotal`.

---

## 7. Requerimientos No Funcionales
*   *Diseño Mobile-First:* Interfaz optimizada al 100% para teléfonos celulares, asegurando un carrusel fluido, visualización de cards compactas y un panel de administración ágil.
*   *Seguridad de Datos:* Conexión cifrada HTTPS para resguardo de la información de contacto y cuentas bancarias expuestas.
*   *Privacidad de la Vista Pública:* La vista pública de disponibilidad no debe mostrar información personal de las clientas; solo bloques genéricos "Ocupado" para horarios reservados.
*   *Autenticación Administrativa:* El acceso al panel de la manicurista debe requerir autenticación por email de dominio (`admin@<dominio>`) y contraseña segura, con opciones de recuperación de cuenta por email.
*   *Control de Concurrencia:* Bloqueo transaccional temporal del horario seleccionado por la clienta en la web para evitar dobles reservas simultáneas. El bloqueo expira automáticamente entre 5 y 10 minutos si no se completa la reserva o no se recibe el comprobante de pago, liberando el horario para otros usuarios.